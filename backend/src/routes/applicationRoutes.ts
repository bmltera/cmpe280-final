import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { JobApplicationService } from '../services/jobApplicationService';
import { GmailService } from '../services/gmailService';

const router = Router();
const jobAppService = new JobApplicationService();
const gmailService = new GmailService();

// GET /api/jobs - Get all job applications for the authenticated user
// (Mapped to /api/applications in index.ts)
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const apps = await jobAppService.getApplications(req.userId!);
    res.json({ success: true, data: apps });
  } catch (err: any) {
    console.error('Error fetching job applications:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch job applications' });
  }
});

// POST /api/jobs/sync - Trigger Gmail sync
router.post('/sync', authMiddleware, async (req: Request, res: Response) => {
  try {
    const syncedCount = await gmailService.syncEmails(req.userId!);
    res.json({ success: true, message: `Synced ${syncedCount} application emails.` });
  } catch (err: any) {
    console.error('Error syncing Gmail:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to sync Gmail' });
  }
});

// PATCH /api/jobs/:id - Manually update a job's status
router.patch('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }
    const updated = await jobAppService.updateApplicationStatus(req.userId!, req.params.id, status);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    console.error('Error updating application:', err);
    res.status(500).json({ success: false, error: 'Failed to update application' });
  }
});

// GET /api/jobs/:id/timeline - Return event history
router.get('/:id/timeline', authMiddleware, async (req: Request, res: Response) => {
  try {
    const timeline = await jobAppService.getApplicationTimeline(req.userId!, req.params.id);
    res.json({ success: true, data: timeline });
  } catch (err: any) {
    console.error('Error fetching timeline:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch timeline' });
  }
});

export default router;
