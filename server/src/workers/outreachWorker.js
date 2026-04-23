import { Worker, Queue } from 'bullmq';
import mongoose from 'mongoose';
import { connection } from '../config/queue.js';
import { generateOutreachMessage } from '../services/outreachService.js';
import Task from '../models/Task.js';
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
    candidateId: task.candidateId?.toString()
  });
}

export const outreachWorker = new Worker('outreach', async (job) => {
  const { candidateId, jobId, taskId } = job.data;
  console.log(`Starting outreach job ${job.id} for candidate ${candidateId}`);

  const task = await Task.findById(taskId);
  await updateTask(task, { status: 'processing', progress: 20 });

  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    await updateTask(task, { progress: 50 });
    const message = await generateOutreachMessage(candidateId, jobId);

    await updateTask(task, {
      status: 'completed',
      progress: 100,
      result: { messageId: message._id.toString(), status: message.status }
    });

    console.log(`Outreach job ${job.id} completed.`);
    return { messageId: message._id, status: message.status };
  } catch (error) {
    console.error(`Outreach job ${job.id} failed:`, error);
    await updateTask(task, { status: 'failed', error: error.message });
    throw error;
  }
}, { connection });

outreachWorker.on('completed', (job) => {
  console.log(`Outreach BullMQ job ${job.id} completed`);
});

outreachWorker.on('failed', (job, err) => {
  console.error(`Outreach BullMQ job ${job.id} failed:`, err.message);
});

export const outreachQueue = new Queue('outreach', { connection });