import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  requirements: [{
    type: String
  }],
  location: {
    type: String,
    default: 'Remote'
  },
  employmentType: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'intern'],
    default: 'full-time'
  },
  status: {
    type: String,
    enum: ['open', 'closed', 'draft'],
    default: 'open'
  }
}, {
  timestamps: true
});

export default mongoose.model('Job', jobSchema);