import express from 'express';
import Task from '../models/Task.js';
import { taskEvents } from '../services/taskEventEmitter.js';

const router = express.Router();

/**
 * GET /api/tasks/:taskId/stream
 * Server-Sent Events endpoint for real-time task status updates.
 * The client subscribes once and receives push updates until task completes/fails.
 */
router.get('/:taskId/stream', async (req, res) => {
  const { taskId } = req.params;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    // Flush if the method exists (some middleware adds it)
    if (res.flush) res.flush();
  };

  // Send initial task state immediately
  try {
    const task = await Task.findById(taskId);
    if (!task) {
      sendEvent({ error: 'Task not found', taskId });
      return res.end();
    }

    sendEvent({
      taskId,
      status: task.status,
      progress: task.progress || 0,
      result: task.result || null,
      error: task.error || null,
      type: task.type
    });

    // If already terminal, no need to keep the connection open
    if (task.status === 'completed' || task.status === 'failed') {
      return res.end();
    }
  } catch (err) {
    sendEvent({ error: 'Failed to fetch task', taskId });
    return res.end();
  }

  // Subscribe to live updates for this specific task
  const onUpdate = (data) => {
    sendEvent(data);
    // Close connection once terminal state is reached
    if (data.status === 'completed' || data.status === 'failed') {
      cleanup();
      res.end();
    }
  };

  const eventKey = `task:${taskId}`;
  taskEvents.on(eventKey, onUpdate);

  // Heartbeat every 20s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
    if (res.flush) res.flush();
  }, 20000);

  const cleanup = () => {
    clearInterval(heartbeat);
    taskEvents.off(eventKey, onUpdate);
  };

  // Clean up when client disconnects
  req.on('close', cleanup);
});

/**
 * GET /api/tasks/:taskId
 * Polling fallback — returns current task status snapshot.
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