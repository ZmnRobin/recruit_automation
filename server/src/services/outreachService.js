import { GoogleGenerativeAI } from '@google/generative-ai';
import Candidate from '../models/Candidate.js';
import Job from '../models/Job.js';
import Message from '../models/Message.js';
import { withRetry } from '../utils/retry.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateOutreachMessage(candidateId, jobId) {
  const candidate = await Candidate.findById(candidateId);
  const job = await Job.findById(jobId);

  if (!candidate || !job) throw new Error('Candidate or Job not found');

  const prompt = `You are a professional recruiter. Generate a personalized outreach message to a candidate about a job opportunity.
Job Position: ${job.title}
Job Description: ${job.description}
Job Requirements: ${job.requirements.join(', ')}
Location: ${job.location}

Candidate Profile:
- Name: ${candidate.name}
- Current Role: ${candidate.currentRole}
- Experience: ${candidate.experience}
- Skills: ${candidate.skills?.join(', ') || 'Not specified'}

Write a professional, personalized outreach message (150-200 words). Be friendly, specific to their background, and include a clear call to action.`;

  let messageContent;
  let usedFallback = false;

  if (process.env.GEMINI_API_KEY) {
    try {
      // generateContent() AND .text() are both inside withRetry
      // so if either fails (including lazy throws from the SDK), it retries
      messageContent = await withRetry(async () => {
        console.log(`[outreachService] Calling Gemini for "${candidate.name}"...`);

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);

        // Explicitly check for blocked/empty response before calling .text()
        const resp = result?.response?.candidates?.[0];
        if (!resp) {
          throw new Error(
            `Gemini returned no candidates. BlockReason: ${result?.response?.promptFeedback?.blockReason ?? 'unknown'}`
          );
        }

        const text = result.response.text();
        if (!text?.trim()) {
          throw new Error('Gemini returned empty outreach message text');
        }

        return text;
      }, 3, 1500); // 3 attempts, 1.5s → 3s → 6s backoff

      console.log(`[outreachService] Gemini message generated for "${candidate.name}"`);
    } catch (error) {
      const isQuota =
        error.message?.includes('429') ||
        error.message?.includes('quota') ||
        error.message?.includes('RESOURCE_EXHAUSTED') ||
        error.status === 429;

      console.warn(
        `[outreachService] Gemini FAILED for "${candidate.name}" — ` +
        `reason: ${isQuota ? 'QUOTA/RATE LIMIT (429)' : error.message} — ` +
        `falling back to template message`
      );

      messageContent = buildFallbackMessage(candidate, job);
      usedFallback = true;
    }
  } else {
    console.log(`[outreachService] No GEMINI_API_KEY — using template for "${candidate.name}"`);
    messageContent = buildFallbackMessage(candidate, job);
    usedFallback = true;
  }

  const message = new Message({
    candidateId: candidate._id,
    jobId: job._id,
    content: messageContent,
    direction: 'outbound',
    status: 'sent',
    source: usedFallback ? 'fallback' : 'ai',
  });

  await message.save();

  candidate.status = 'contacted';
  await candidate.save();

  console.log(
    `[outreachService] Message saved for "${candidate.name}" ` +
    `(source: ${usedFallback ? 'template' : 'gemini'})`
  );

  return message;
}

function buildFallbackMessage(candidate, job) {
  const firstName = candidate.name.split(' ')[0];
  const topSkills = (candidate.skills || []).slice(0, 3);
  const hasSkills = topSkills.length > 0;
  const isRemote = job.location?.toLowerCase().includes('remote');

  const openings = [
    `I came across your profile and was genuinely impressed by your background as ${candidate.currentRole}.`,
    `Your experience as ${candidate.currentRole} caught my attention while I was searching for strong candidates.`,
    `I've been looking for someone with your background in ${candidate.currentRole}, and your profile stood out.`,
  ];
  const opening = openings[candidate.name.length % openings.length];

  const skillsSentence = hasSkills
    ? `Your expertise in ${topSkills.join(', ')} is a strong match for what we need.`
    : `Your experience aligns well with what we're looking for in this role.`;

  const locationSentence = isRemote
    ? `The position is fully remote, so there's no relocation required.`
    : `The role is based in ${job.location}, offering a ${job.employmentType || 'full-time'} position.`;

  const yearsMatch = candidate.experience?.match(/(\d+)/);
  const years = yearsMatch ? parseInt(yearsMatch[1]) : 0;
  const cta = years >= 5
    ? `I'd love to have a quick 20-minute call to share more details and hear about your career goals. Would you be open to connecting this week?`
    : `I'd be happy to share more about the opportunity and answer any questions. Would you have 15 minutes for a quick call?`;

  return `Hi ${firstName},

${opening} We're currently hiring for a ${job.title} position and I think you could be a great fit.

${skillsSentence} ${locationSentence}

${cta}

Looking forward to hearing from you.

Best regards,
The Recruiting Team`;
}