import { Queue, Worker } from 'bullmq';
import { createRedisClient } from './redis.js';

const connection = createRedisClient();

// Sourcing queue
export const sourcingQueue = new Queue('sourcing', { connection });
export const sourcingWorker = null; // Will be created in worker file

// Scoring queue
export const scoringQueue = new Queue('scoring', { connection });

// Outreach queue
export const outreachQueue = new Queue('outreach', { connection });

export { connection };