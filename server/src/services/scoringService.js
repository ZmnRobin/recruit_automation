import { GoogleGenerativeAI } from '@google/generative-ai';
import cacheClient from '../config/redis.js';
import Candidate from '../models/Candidate.js';
import { withRetry } from '../utils/retry.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SCORE_CACHE_TTL = 60 * 60 * 24; // 24 hours for AI scores
const FALLBACK_CACHE_TTL = 60 * 60;   // 1 hour for rule-based scores

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
      scoreData = await callGeminiWithRetry(prompt, candidate.name);
    } catch (error) {
      // Log the real error clearly so you can see exactly what Gemini returned
      const isQuota = isQuotaError(error);
      console.warn(
        `[scoringService] Gemini FAILED for "${candidate.name}" — ` +
        `reason: ${isQuota ? 'QUOTA/RATE LIMIT (429)' : error.message} — ` +
        `falling back to rule-based scoring`
      );
      scoreData = calculateFallbackScore(candidate, job);
      usedFallback = true;
    }
  } else {
    console.log(`[scoringService] No GEMINI_API_KEY — using rule-based scoring for "${candidate.name}"`);
    scoreData = calculateFallbackScore(candidate, job);
    usedFallback = true;
  }

  candidate.score = {
    value: scoreData.score,
    reasoning: scoreData.reasoning,
    scoredAt: new Date(),
    source: usedFallback ? 'fallback' : 'ai',
  };
  candidate.status = 'scored';
  await candidate.save();

  const ttl = usedFallback ? FALLBACK_CACHE_TTL : SCORE_CACHE_TTL;
  await cacheClient.setex(`score:${candidateId}`, ttl, JSON.stringify(candidate.score));

  console.log(
    `[scoringService] Score saved for "${candidate.name}": ` +
    `${scoreData.score}/100 (source: ${usedFallback ? 'rule-based' : 'gemini'})`
  );

  return candidate.score;
}

/**
 * Calls Gemini and fully unwraps the response before returning.
 * This is important — Gemini sometimes returns a result object
 * without throwing, but .text() then throws internally.
 * By calling .text() inside here, withRetry can catch that too.
 */
async function callGeminiWithRetry(prompt, candidateName) {
  return withRetry(async () => {
    console.log(`[scoringService] Calling Gemini for "${candidateName}"...`);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    // Both generateContent() and .text() can fail — keep them together
    // inside the retry so both are retried on 503
    const result = await model.generateContent(prompt);

    // Check if Gemini blocked the response (no throw, but no content either)
    const candidate_resp = result?.response?.candidates?.[0];
    if (!candidate_resp) {
      throw new Error(`Gemini returned no candidates. FinishReason: ${result?.response?.promptFeedback?.blockReason ?? 'unknown'}`);
    }

    // Now extract text — this can also throw if content is empty
    const rawText = result.response.text();
    if (!rawText?.trim()) {
      throw new Error('Gemini returned an empty response text');
    }

    console.log(`[scoringService] Gemini raw response for "${candidateName}": ${rawText.slice(0, 120)}...`);

    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (typeof parsed.score !== 'number') {
      throw new Error(`Gemini response missing score field: ${cleaned}`);
    }

    return parsed;
  }, 3, 1500); // 3 attempts, 1.5s base delay → 1.5s, 3s, 6s
}

export async function getCachedScore(candidateId) {
  try {
    const cached = await cacheClient.get(`score:${candidateId}`);
    if (!cached) return null;

    const parsed = JSON.parse(cached);

    // Never serve fallback scores from cache — force a fresh AI attempt
    if (parsed.source === 'fallback') {
      await cacheClient.del(`score:${candidateId}`);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function isQuotaError(error) {
  return (
    error.message?.includes('429') ||
    error.message?.includes('quota') ||
    error.message?.includes('RESOURCE_EXHAUSTED') ||
    error.status === 429
  );
}

function calculateFallbackScore(candidate, job) {
  let score = 40;
  const reasons = [];

  const candidateSkills = (candidate.skills || []).map(s => s.toLowerCase());
  const jobRequirements = (job.requirements || []).map(r => r.toLowerCase());

  // Skills — up to 30 pts
  const matchedSkills = jobRequirements.filter(req =>
    candidateSkills.some(skill => skill.includes(req) || req.includes(skill))
  );
  if (matchedSkills.length > 0) {
    score += Math.min(matchedSkills.length * 8, 30);
    reasons.push(`Matches ${matchedSkills.length}/${jobRequirements.length} required skills`);
  } else {
    reasons.push('No direct skill matches found');
  }

  // Title relevance — up to 15 pts
  if (candidate.currentRole) {
    const jobWords = job.title.toLowerCase().split(/\s+/);
    const roleWords = candidate.currentRole.toLowerCase().split(/\s+/);
    const overlap = jobWords.filter(w =>
      w.length > 2 && roleWords.some(rw => rw.includes(w) || w.includes(rw))
    );
    if (overlap.length > 0) {
      score += Math.min(overlap.length * 7, 15);
      reasons.push('Job title aligns with current role');
    }
  }

  // Experience — up to 10 pts
  if (candidate.experience) {
    const yearsMatch = candidate.experience.match(/(\d+)/);
    if (yearsMatch) {
      const years = parseInt(yearsMatch[1]);
      if (years >= 5)      { score += 10; reasons.push('5+ years experience'); }
      else if (years >= 3) { score += 6;  reasons.push('3+ years experience'); }
      else if (years >= 1) { score += 3;  reasons.push('1+ years experience'); }
    }
  }

  // Location — up to 5 pts
  if (candidate.location && job.location) {
    const locMatch =
      candidate.location.toLowerCase().includes(job.location.toLowerCase()) ||
      job.location.toLowerCase().includes('remote') ||
      candidate.location.toLowerCase().includes('remote');
    if (locMatch) { score += 5; reasons.push('Location match'); }
  }

  return {
    score: Math.min(Math.max(score, 0), 100),
    reasoning: `[Rule-based] ${reasons.join('. ') || 'Basic profile evaluated'}.`,
  };
}