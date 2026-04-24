import express from 'express';
import Candidate from '../models/Candidate.js';
import Message from '../models/Message.js';
import Task from '../models/Task.js';
import { scoringQueue } from '../workers/scoringWorker.js';
import { outreachQueue } from '../workers/outreachWorker.js';
import { getCachedScore } from '../services/scoringService.js';

const router = express.Router();

// Get all candidates
router.get('/', async (req, res) => {
  try {
    const candidates = await Candidate.find()
      .populate('jobId')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: candidates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get candidate by ID
router.get('/:id', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id).populate('jobId');
    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }
    res.json({ success: true, data: candidate });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Score a candidate (AI-powered)
router.post('/:id/scores', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id).populate('jobId');
    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }

    // Check cache first — return immediately, no task needed
    const cachedScore = await getCachedScore(candidate._id.toString());
    if (cachedScore) {
      return res.json({
        success: true,
        data: cachedScore,
        cached: true
      });
    }

    // Create task to track scoring
    const task = new Task({
      type: 'scoring',
      status: 'queued',
      candidateId: candidate._id,
      jobId: candidate.jobId._id
    });
    await task.save();

    // Add to scoring queue
    await scoringQueue.add('score-candidate', {
      candidateId: candidate._id.toString(),
      jobId: candidate.jobId._id.toString(),
      taskId: task._id.toString()
    });

    // 202 Accepted — task is queued, client should stream via SSE
    res.status(202).json({
      success: true,
      data: {
        taskId: task._id.toString(),
        status: 'queued'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Trigger outreach to a candidate
router.post('/:id/outreach', async (req, res) => {
  try {
    const { jobId } = req.body;
    const candidate = await Candidate.findById(req.params.id);

    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }

    const task = new Task({
      type: 'outreach',
      status: 'queued',
      candidateId: candidate._id,
      jobId
    });
    await task.save();

    await outreachQueue.add('outreach-candidate', {
      candidateId: candidate._id.toString(),
      jobId,
      taskId: task._id.toString()
    });

    res.status(202).json({
      success: true,
      data: {
        taskId: task._id.toString(),
        status: 'queued'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Handle candidate response
router.post('/:id/responses', async (req, res) => {
  try {
    const { message } = req.body;
    const candidate = await Candidate.findById(req.params.id);

    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }

    const msg = new Message({
      candidateId: candidate._id,
      jobId: candidate.jobId,
      content: message,
      direction: 'inbound',
      status: 'delivered'
    });
    await msg.save();

    const lowerMessage = message.toLowerCase();
    let intent = 'neutral';

    if (lowerMessage.includes('yes') || lowerMessage.includes('interested') ||
        lowerMessage.includes('sure') || lowerMessage.includes('great') ||
        lowerMessage.includes('love')) {
      intent = 'interested';
    } else if (lowerMessage.includes('no') || lowerMessage.includes('not interested') ||
               lowerMessage.includes('pass') || lowerMessage.includes('not looking')) {
      intent = 'not_interested';
    }

    msg.intent = intent;

    if (intent === 'interested') {
      candidate.status = 'interested';
      msg.scheduledLink = `https://calendly.com/mock-scheduling/${candidate._id}`;
      await candidate.save();
    } else if (intent === 'not_interested') {
      candidate.status = 'not_interested';
      await candidate.save();
    }

    await msg.save();

    res.json({
      success: true,
      data: { message: msg, intent, scheduledLink: msg.scheduledLink }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get messages for a candidate
router.get('/:id/messages', async (req, res) => {
  try {
    const messages = await Message.find({ candidateId: req.params.id })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;