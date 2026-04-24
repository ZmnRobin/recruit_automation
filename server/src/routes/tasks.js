import express from 'express';
import Task from '../models/Task.js';
import { taskBus } from '../services/taskSubscriber.js';

const router = express.Router();

/**
 * GET /api/tasks/:taskId/stream
 * SSE endpoint — streams task status to the client until terminal state.
 */
router.get('/:taskId/stream', async (req, res) => {
  const { taskId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (res.flush) res.flush();
  };

  // 1. Send current snapshot immediately so client isn't left waiting
  try {
    const task = await Task.findById(taskId);
    if (!task) {
      send({ error: 'Task not found', taskId });
      return res.end();
    }

    send({
      taskId,
      type: task.type,
      status: task.status,
      progress: task.progress || 0,
      result: task.result || null,
      error: task.error || null,
    });

    // Already done — no need to keep the SSE connection open
    if (task.status === 'completed' || task.status === 'failed') {
      return res.end();
    }
  } catch (err) {
    send({ error: 'Failed to fetch task', taskId });
    return res.end();
  }

  // 2. Subscribe to live Redis-backed updates
  const onUpdate = (data) => {
    send(data);
    if (data.status === 'completed' || data.status === 'failed') {
      cleanup();
      res.end();
    }
  };

  const eventKey = `task:${taskId}`;
  taskBus.on(eventKey, onUpdate);

  // Heartbeat every 20s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
    if (res.flush) res.flush();
  }, 20000);

  const cleanup = () => {
    clearInterval(heartbeat);
    taskBus.off(eventKey, onUpdate);
  };

  req.on('close', cleanup);
});

/**
 * GET /api/tasks/:taskId
 * Polling fallback — returns current task snapshot.
 */
router.get('/:taskId', async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;