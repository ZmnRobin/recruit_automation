import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: true
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  direction: {
    type: String,
    enum: ['outbound', 'inbound'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed'],
    default: 'pending'
  },
  intent: {
    type: String,
    enum: ['interested', 'not_interested', 'neutral', null],
    default: null
  },
  scheduledLink: String
}, {
  timestamps: true
});

export default mongoose.model('Message', messageSchema);