import { GoogleGenerativeAI } from '@google/generative-ai';
import Candidate from '../models/Candidate.js';
import Job from '../models/Job.js';
import Message from '../models/Message.js';
import { withRetry } from '../utils/retry.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateOutreachMessage(candidateId, jobId) {
  const candidate = await Candidate.findById(candidateId);
  const job = await Job.findById(jobId);

  if (!candidate || !job) {
    throw new Error('Candidate or Job not found');
  }

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

  try {
    if (process.env.GEMINI_API_KEY) {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });  // or 'gemini-1.5-pro'
      const result = await withRetry(() => model.generateContent(prompt));
      messageContent = result.response.text();
    } else {
      // Fallback message
      messageContent = `Hi ${candidate.name.split(' ')[0]},
                        I came across your profile and was impressed by your experience as ${candidate.currentRole}. We're hiring for a ${job.title} position at our company, and I think you'd be a great fit!
                        The role is ${job.location} and offers ${job.employmentType} employment. Your skills in ${candidate.skills?.slice(0, 3).join(', ')} align well with what we're looking for.
                        Would you be interested in learning more about this opportunity? I'd love to schedule a quick call to discuss.
                        Best regards,
                        Recruiting Team`;}

    const message = new Message({
      candidateId: candidate._id,
      jobId: job._id,
      content: messageContent,
      direction: 'outbound',
      status: 'sent'
    });

    await message.save();

    candidate.status = 'contacted';
    await candidate.save();
    return message;
  } catch (error) {
    console.error('Gemini outreach generation error:', error.message);

    const message = new Message({
      candidateId: candidate._id,
      jobId: job._id,
      content: `Hi ${candidate.name.split(' ')[0]}, We have an exciting opportunity as ${job.title} that matches your skills. Would you be interested?`,
      direction: 'outbound',
      status: 'sent'
    });

    await message.save();
    candidate.status = 'contacted';
    await candidate.save();

    return message;
  }
}