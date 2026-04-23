import mongoose from 'mongoose';
import dotenv from 'dotenv';

import './sourcingWorker.js';
import './scoringWorker.js';
import './outreachWorker.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/recruit-automation';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Worker connected to MongoDB');
    console.log('All workers started and waiting for jobs...');
  })
  .catch((err) => {
    console.error('Worker MongoDB connection error:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down workers...');
  process.exit(0);
});