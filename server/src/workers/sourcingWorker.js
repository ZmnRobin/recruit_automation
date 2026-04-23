import { Worker, Queue } from 'bullmq';
import mongoose from 'mongoose';
import { connection } from '../config/queue.js';
import { searchCandidates } from '../services/sourcingService.js';
import Candidate from '../models/Candidate.js';
import Task from '../models/Task.js';
import Job from '../models/Job.js';
import { taskEvents } from '../services/taskEventEmitter.js';

async function updateTask(task, fields) {
  if (!task) return;
  Object.assign(task, fields);
  await task.save();
  taskEvents.emitTaskUpdate(task._id.toString(), {
    taskId: task._id.toString(),
    type: task.type,
    status: task.status,
    progress: task.progress || 0,
    result: task.result || null,
    error: task.error || null,
    jobId: task.jobId?.toString()
  });
}

export const sourcingWorker = new Worker('sourcing', async (job) => {
  const { jobId, query, limit, taskId } = job.data;
  console.log(`Starting sourcing job ${job.id} for job ${jobId}`);

  const task = await Task.findById(taskId);
  await updateTask(task, { status: 'processing', progress: 10 });

  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    await updateTask(task, { progress: 30 });
    const candidatesData = await searchCandidates(query, limit);
    await updateTask(task, { progress: 60 });

    let savedCount = 0;
    for (const candidateData of candidatesData) {
      const existingCandidate = await Candidate.findOne({
        linkedinUrl: candidateData.linkedinUrl
      });

      if (!existingCandidate) {
        const candidate = new Candidate({
          jobId,
          name: candidateData.name,
          email: candidateData.email,
          linkedinUrl: candidateData.linkedinUrl,
          currentRole: candidateData.currentRole,
          experience: candidateData.experience,
          skills: candidateData.skills,
          location: candidateData.location,
          sourcedFrom: candidateData.sourcedFrom
        });
        await candidate.save();
        savedCount++;
      }
    }

    await updateTask(task, {
      status: 'completed',
      progress: 100,
      result: { found: candidatesData.length, saved: savedCount }
    });

    await Job.findByIdAndUpdate(jobId, {
      $inc: { 'metadata.candidateCount': savedCount }
    }).catch(() => {});

    console.log(`Sourcing job ${job.id} completed. Found ${savedCount} new candidates.`);
    return { found: candidatesData.length, saved: savedCount };
  } catch (error) {
    console.error(`Sourcing job ${job.id} failed:`, error);
    await updateTask(task, { status: 'failed', error: error.message });
    throw error;
  }
}, { connection });

sourcingWorker.on('completed', (job) => {
  console.log(`Sourcing BullMQ job ${job.id} completed`);
});

sourcingWorker.on('failed', (job, err) => {
  console.error(`Sourcing BullMQ job ${job.id} failed:`, err.message);
});

export const sourcingQueue = new Queue('sourcing', { connection });