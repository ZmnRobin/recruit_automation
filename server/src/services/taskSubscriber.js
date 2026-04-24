/**
 * taskSubscriber.js
 * Used by the EXPRESS SERVER only.
 * Subscribes to Redis and re-emits updates as local Node EventEmitter events
 * so the SSE route can push them to connected clients.
 */
import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { TASK_UPDATES_CHANNEL } from './taskPublisher.js';

class TaskEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200);
  }

  emitUpdate(taskId, data) {
    // Emit to specific task listeners and wildcard listeners
    this.emit(`task:${taskId}`, data);
  }
}

export const taskBus = new TaskEventBus();

let _subscriber = null;

/**
 * Call once when the Express server starts.
 * Opens a dedicated Redis connection for subscriptions (ioredis best practice).
 */
export function startTaskSubscriber() {
  if (_subscriber) return; // Already started

  _subscriber = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => Math.min(times * 100, 3000),
  });

  _subscriber.on('error', (err) => {
    console.error('[taskSubscriber] Redis error:', err.message);
  });

  _subscriber.subscribe(TASK_UPDATES_CHANNEL, (err) => {
    if (err) {
      console.error('[taskSubscriber] Failed to subscribe:', err.message);
    } else {
      console.log(`[taskSubscriber] Subscribed to "${TASK_UPDATES_CHANNEL}"`);
    }
  });

  _subscriber.on('message', (channel, message) => {
    if (channel !== TASK_UPDATES_CHANNEL) return;
    try {
      const data = JSON.parse(message);
      if (data.taskId) {
        taskBus.emitUpdate(data.taskId, data);
      }
    } catch (err) {
      console.error('[taskSubscriber] Failed to parse message:', err.message);
    }
  });
}