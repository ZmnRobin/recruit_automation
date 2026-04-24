import { GoogleGenerativeAI } from '@google/generative-ai';
import cacheClient from '../config/redis.js';
import Candidate from '../models/Candidate.js';
import { withRetry } from '../utils/retry.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SCORE_CACHE_TTL = 60 * 60 * 24; // 24 hours

export async function generateScore(candidateId) {
  const candidate = await Candidate.findById(candidateId).populate('jobId');
  if (!candidate) throw new Error('Candidate not found');

  const job = candidate.jobId;

  const prompt = `You are a recruiting expert. Score how well the following candidate matches the job requirements.
Job Title: ${job.title}
Job Description: ${job.description}
Job Requirements: ${job.requirements.join(', ')}

Candidate Information:
- Name: ${candidate.name}
- Current Role: ${candidate.currentRole}
- Experience: ${candidate.experience}
- Skills: ${candidate.skills?.join(', ') || 'Not specified'}
- Location: ${candidate.location}

Provide a score from 0-100 and brief reasoning.
IMPORTANT: Respond ONLY with a valid JSON object, no markdown, no backticks, no explanation outside the JSON.
Format: { "score": <number>, "reasoning": "<brief explanation>" }`;

  let scoreData;
  let usedFallback = false;

  if (process.env.GEMINI_API_KEY) {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json' }
      });

      const result = await withRetry(() => model.generateContent(prompt), {
        retries: 2,
        delayMs: 1500,
      });

      const cleaned = result.response.text().replace(/```json|```/g, '').trim();
      scoreData = JSON.parse(cleaned);
      console.log(`[scoringService] Gemini score for ${candidate.name}:`, scoreData.score);
    } catch (error) {
      const isQuota = error.message?.includes('quota') ||
                      error.message?.includes('429') ||
                      error.status === 429;

      console.warn(`[scoringService] Gemini ${isQuota ? 'quota exceeded' : 'error'} for ${candidate.name}:`, error.message);
      scoreData = calculateFallbackScore(candidate, job);
      usedFallback = true;
    }
  } else {
    scoreData = calculateFallbackScore(candidate, job);
    usedFallback = true;
  }

  if (usedFallback) {
    console.log(`[scoringService] Used rule-based fallback for ${candidate.name} — score: ${scoreData.score}`);
  }

  candidate.score = {
    value: scoreData.score,
    reasoning: scoreData.reasoning,
    scoredAt: new Date(),
    source: usedFallback ? 'fallback' : 'ai',
  };
  candidate.status = 'scored';
  await candidate.save();

  // Cache the result — use a shorter TTL for fallback scores so they
  // get re-evaluated by AI next time the quota resets (1 hour vs 24 hours)
  const ttl = usedFallback ? 60 * 60 : SCORE_CACHE_TTL;
  await cacheClient.setex(
    `score:${candidateId}`,
    ttl,
    JSON.stringify(candidate.score)
  );

  return candidate.score;
}

export async function getCachedScore(candidateId) {
  try {
    const cached = await cacheClient.get(`score:${candidateId}`);
    if (!cached) return null;

    const parsed = JSON.parse(cached);

    // Don't return fallback scores from cache — let them be re-scored by AI
    // (they already have a shorter 1-hour TTL, but this is a belt-and-suspenders check)
    if (parsed.source === 'fallback') {
      await cacheClient.del(`score:${candidateId}`);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Rule-based scoring — used when Gemini is unavailable.
 * More thorough than the original: weights skills, title match,
 * experience level, and location preference.
 */
function calculateFallbackScore(candidate, job) {
  let score = 40; // Conservative base — we don't actually know without AI
  const reasons = [];

  const candidateSkills = (candidate.skills || []).map(s => s.toLowerCase());
  const jobRequirements = (job.requirements || []).map(r => r.toLowerCase());

  // Skill matching — up to 30 points
  const matchedSkills = jobRequirements.filter(req =>
    candidateSkills.some(skill => skill.includes(req) || req.includes(skill))
  );
  if (matchedSkills.length > 0) {
    const skillPoints = Math.min(matchedSkills.length * 8, 30);
    score += skillPoints;
    reasons.push(`Matches ${matchedSkills.length}/${jobRequirements.length} required skills`);
  } else {
    reasons.push('No direct skill matches found');
  }

  // Title relevance — up to 15 points
  if (candidate.currentRole) {
    const jobWords = job.title.toLowerCase().split(/\s+/);
    const roleWords = candidate.currentRole.toLowerCase().split(/\s+/);
    const overlap = jobWords.filter(w => w.length > 2 && roleWords.some(rw => rw.includes(w) || w.includes(rw)));
    if (overlap.length > 0) {
      score += Math.min(overlap.length * 7, 15);
      reasons.push('Job title aligns with current role');
    }
  }

  // Experience — up to 10 points
  if (candidate.experience) {
    const yearsMatch = candidate.experience.match(/(\d+)/);
    if (yearsMatch) {
      const years = parseInt(yearsMatch[1]);
      if (years >= 5) { score += 10; reasons.push('5+ years experience'); }
      else if (years >= 3) { score += 6; reasons.push('3+ years experience'); }
      else if (years >= 1) { score += 3; reasons.push('1+ years experience'); }
    }
  }

  // Location — up to 5 points
  if (candidate.location && job.location) {
    const locMatch = candidate.location.toLowerCase().includes(job.location.toLowerCase()) ||
                     job.location.toLowerCase().includes('remote') ||
                     candidate.location.toLowerCase().includes('remote');
    if (locMatch) {
      score += 5;
      reasons.push('Location match');
    }
  }

  score = Math.min(Math.max(score, 0), 100);

  return {
    score,
    reasoning: `[Rule-based] ${reasons.join('. ') || 'Basic profile evaluated'}.`,
  };
}