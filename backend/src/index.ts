import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jobRoutes from './routes/jobRoutes';
import trackedJobRoutes from './routes/trackedJobRoutes';
import adminRoutes from './routes/adminRoutes';
import applicationRoutes from './routes/applicationRoutes';
import gmailRoutes from './routes/gmailRoutes';
import { initCronJobs } from './cron/scheduler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Middleware
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'healthy', timestamp: new Date().toISOString() } });
});

// Routes
app.use('/api/jobs', applicationRoutes); // Handle application tracking specific /api/jobs endpoints
app.use('/api/jobs', jobRoutes); // Fallback for other job endpoints
app.use('/api/tracked-jobs', trackedJobRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/gmail', gmailRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 CORS enabled for: ${FRONTEND_URL}`);

  // Initialize cron jobs
  initCronJobs();
});

export default app;
