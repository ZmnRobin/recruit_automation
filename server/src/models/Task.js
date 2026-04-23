import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['sourcing', 'scoring', 'outreach']
  },
  status: {
    type: String,
    required: true,
    enum: ['queued', 'processing', 'completed', 'failed'],
    default: 'queued'
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job'
  },
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate'
  },
  result: mongoose.Schema.Types.Mixed,
  error: String,
  progress: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export default mongoose.model('Task', taskSchema);