import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { JobService } from '../services/jobService';
import { SettingsRepository } from '../repositories/settingsRepository';

const router = Router();
const jobService = new JobService();
const settingsRepo = new SettingsRepository();

// GET /api/jobs/discover - Get jobs for discovery
router.get('/discover', authMiddleware, async (req: Request, res: Response) => {
  try {
    // Read the persistent salary-only setting from the database
    const salaryOnly = await settingsRepo.getSalaryOnly();
    const jobs = await jobService.getDiscoverJobs(req.userId!, salaryOnly);
    res.json({ success: true, data: jobs });
  } catch (err: any) {
    console.error('Error fetching discover jobs:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch jobs' });
  }
});

// GET /api/jobs/:id - Get single job
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const job = await jobService.getJobById(req.params.id as string);
    if (!job) {
      res.status(404).json({ success: false, error: 'Job not found' });
      return;
    }
    res.json({ success: true, data: job });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch job' });
  }
});

// POST /api/jobs/:id/dismiss - Dismiss a job
router.post('/:id/dismiss', authMiddleware, async (req: Request, res: Response) => {
  try {
    await jobService.dismissJob(req.userId!, req.params.id as string);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to dismiss job' });
  }
});

// POST /api/jobs/:id/apply-clicked - Record apply click
router.post('/:id/apply-clicked', authMiddleware, async (req: Request, res: Response) => {
  try {
    await jobService.applyClicked(req.userId!, req.params.id as string);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to record apply click' });
  }
});

// POST /api/jobs/:id/apply-confirmed - Confirm application
router.post('/:id/apply-confirmed', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tracked = await jobService.applyConfirmed(req.userId!, req.params.id as string);
    res.json({ success: true, data: tracked });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to confirm application' });
  }
});

export default router;
