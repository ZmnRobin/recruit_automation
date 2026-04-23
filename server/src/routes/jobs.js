import express from 'express';
import Job from '../models/Job.js';
import Candidate from '../models/Candidate.js';
import Task from '../models/Task.js';
import { sourcingQueue } from '../workers/sourcingWorker.js';

const router = express.Router();

// Create a new job
router.post('/', async (req, res) => {
  try {
    const job = new Job(req.body);
    await job.save();
    res.status(201).json({ success: true, data: job });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// List all jobs
router.get('/', async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 });
    res.json({ success: true, data: jobs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get job details
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    res.json({ success: true, data: job });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Trigger candidate sourcing for a job
router.post('/:id/sourcing-tasks', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    const { query, limit = 10 } = req.body;

    // Create a task to track the sourcing job
    const task = new Task({
      type: 'sourcing',
      status: 'queued',
      jobId: job._id
    });
    await task.save();

    // Add job to queue
    await sourcingQueue.add('source-candidates', {
      jobId: job._id.toString(),
      query: query || `${job.title} ${job.description.split(' ').slice(0, 5).join(' ')}`,
      limit,
      taskId: task._id.toString()
    });

    res.status(202).json({
      success: true,
      data: {
        taskId: task._id,
        status: 'queued'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get candidates for a job
router.get('/:id/candidates', async (req, res) => {
  try {
    const candidates = await Candidate.find({ jobId: req.params.id })
      .populate('score')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: candidates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;