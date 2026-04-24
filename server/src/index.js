import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import jobRoutes from './routes/jobs.js';
import candidateRoutes from './routes/candidates.js';
import taskRoutes from './routes/tasks.js';
import { startTaskSubscriber } from './services/taskSubscriber.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
startTaskSubscriber();

// Routes
app.use('/api/jobs', jobRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/tasks', taskRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/recruit-automation';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

export default app;