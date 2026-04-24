/**
 * taskPublisher.js
 * Used by WORKERS to publish task updates into Redis.
 * Workers import this and call publish() after every status change.
 */
import Redis from 'ioredis';

const CHANNEL = 'task-updates';

// Lazy singleton — created once per process
let _publisher = null;

function getPublisher() {
  if (!_publisher) {
    _publisher = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      // Never block the worker if Redis is temporarily down
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(times * 100, 2000),
    });

    _publisher.on('error', (err) => {
      console.error('[taskPublisher] Redis error:', err.message);
    });
  }
  return _publisher;
}

/**
 * Publish a task update so the Express SSE route can forward it to clients.
 * Fire-and-forget — we never want a Redis hiccup to break the worker.
 */
export async function publishTaskUpdate(taskId, data) {
  try {
    const pub = getPublisher();
    await pub.publish(CHANNEL, JSON.stringify({ taskId, ...data }));
  } catch (err) {
    console.error('[taskPublisher] Failed to publish task update:', err.message);
  }
}

export const TASK_UPDATES_CHANNEL = CHANNEL;