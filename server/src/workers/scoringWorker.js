import { Worker, Queue } from 'bullmq';
import mongoose from 'mongoose';
import { connection } from '../config/queue.js';
import { generateScore } from '../services/scoringService.js';
import Task from '../models/Task.js';
import { publishTaskUpdate } from '../services/taskPublisher.js';

async function updateTask(task, fields) {
  if (!task) return;
  Object.assign(task, fields);
  await task.save();
  await publishTaskUpdate(task._id.toString(), {
    taskId: task._id.toString(),
    type: task.type,
    status: task.status,
    progress: task.progress || 0,
    result: task.result ? JSON.parse(JSON.stringify(task.result)) : null,
    error: task.error || null,
    candidateId: task.candidateId?.toString(),
  });
}

export const scoringWorker = new Worker('scoring', async (job) => {
  const { candidateId, taskId } = job.data;
  console.log(`Starting scoring job ${job.id} for candidate ${candidateId}`);

  const task = await Task.findById(taskId);
  await updateTask(task, { status: 'processing', progress: 20 });

  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    await updateTask(task, { progress: 50 });
    const scoreResult = await generateScore(candidateId);

    // Serialize explicitly — scoreResult is a Mongoose subdocument
    await updateTask(task, {
      status: 'completed',
      progress: 100,
      result: {
        value: scoreResult.value,
        reasoning: scoreResult.reasoning,
        scoredAt: scoreResult.scoredAt,
      },
    });

    console.log(`Scoring job ${job.id} completed. Score: ${scoreResult.value}`);
    return scoreResult;
  } catch (error) {
    console.error(`Scoring job ${job.id} failed:`, error);
    await updateTask(task, { status: 'failed', error: error.message });
    throw error;
  }
}, { connection });

scoringWorker.on('completed', (job) => console.log(`Scoring BullMQ job ${job.id} completed`));
scoringWorker.on('failed', (job, err) => console.error(`Scoring BullMQ job ${job.id} failed:`, err.message));

export const scoringQueue = new Queue('scoring', { connection });