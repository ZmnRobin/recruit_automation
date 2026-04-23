import { GoogleGenerativeAI } from '@google/generative-ai';
import cacheClient from '../config/redis.js';
import Candidate from '../models/Candidate.js';
import Job from '../models/Job.js';
import { withRetry } from '../utils/retry.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SCORE_CACHE_TTL = 60 * 60 * 24; // 24 hours

export async function generateScore(candidateId) {
  const candidate = await Candidate.findById(candidateId).populate('jobId');
  if (!candidate) {
    throw new Error('Candidate not found');
  }

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
                  Format:
                  {
                    "score": <number>,
                    "reasoning": "<brief explanation>"
                  }`;

  try {
    let scoreData;
    if (process.env.GEMINI_API_KEY) {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json' 
        }
      });

      const result = await withRetry(() => model.generateContent(prompt));
      const rawText = result.response.text();

      // Safe parse — strip accidental markdown fences if present
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      scoreData = JSON.parse(cleaned);

      console.log('Gemini score response:', scoreData);
    } else {
      scoreData = calculateFallbackScore(candidate, job);
    }

    candidate.score = {
      value: scoreData.score,
      reasoning: scoreData.reasoning,
      scoredAt: new Date()
    };
    candidate.status = 'scored';
    await candidate.save();

    await cacheClient.setex(
      `score:${candidateId}`,
      SCORE_CACHE_TTL,
      JSON.stringify(candidate.score)
    );

    return candidate.score;
  } catch (error) {
    console.error('Gemini scoring error:', error.message);

    const fallbackScore = calculateFallbackScore(candidate, job);
    candidate.score = {
      value: fallbackScore.score,
      reasoning: fallbackScore.reasoning,
      scoredAt: new Date()
    };
    candidate.status = 'scored';
    await candidate.save();

    return candidate.score;
  }
}

export async function getCachedScore(candidateId) {
  const cached = await cacheClient.get(`score:${candidateId}`);
  if (cached) {
    return JSON.parse(cached);
  }
  return null;
}

// Unchanged — no AI dependency
function calculateFallbackScore(candidate, job) {
  let score = 50;
  const reasons = [];

  const candidateSkills = (candidate.skills || []).map(s => s.toLowerCase());
  const jobRequirements = (job.requirements || []).map(r => r.toLowerCase());

  const matchedSkills = jobRequirements.filter(req =>
    candidateSkills.some(skill => skill.includes(req) || req.includes(skill))
  );

  if (matchedSkills.length > 0) {
    score += matchedSkills.length * 10;
    reasons.push(`Matches ${matchedSkills.length} required skills`);
  }

  if (candidate.currentRole) {
    const jobTitleWords = job.title.toLowerCase().split(' ');
    const roleWords = candidate.currentRole.toLowerCase().split(' ');
    const commonWords = jobTitleWords.filter(w =>
      w.length > 2 && roleWords.some(rw => rw.includes(w) || w.includes(rw))
    );

    if (commonWords.length > 0) {
      score += 15;
      reasons.push('Job title matches candidate role');
    }
  }

  score = Math.min(score, 100);

  return {
    score,
    reasoning: reasons.length > 0 ? reasons.join('. ') : 'Basic skills match'
  };
}