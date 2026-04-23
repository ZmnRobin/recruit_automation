import mongoose from 'mongoose';

const candidateSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: String,
  phone: String,
  linkedinUrl: {
    type: String,
    unique: true,
    sparse: true
  },
  resumeUrl: String,
  currentRole: String,
  experience: String,
  skills: [String],
  location: String,
  status: {
    type: String,
    enum: ['sourced', 'scored', 'contacted', 'interested', 'not_interested', 'scheduled'],
    default: 'sourced'
  },
  score: {
    value: Number,
    reasoning: String,
    scoredAt: Date
  },
  sourcedFrom: {
    type: String,
    default: 'api'
  }
}, {
  timestamps: true
});

export default mongoose.model('Candidate', candidateSchema);