import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { JobService } from '../services/jobService';
import { KanbanStatus } from '../types';

const router = Router();
const jobService = new JobService();

const validStatuses: KanbanStatus[] = ['Applied', 'OA', 'Interview', 'Offer', 'Rejected'];

// GET /api/tracked-jobs - Get all tracked jobs for the user
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const jobs = await jobService.getTrackedJobs(req.userId!);
    res.json({ success: true, data: jobs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch tracked jobs' });
  }
});

// PATCH /api/tracked-jobs/:id/status - Update status
router.patch('/:id/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid status' });
      return;
    }

    const updated = await jobService.updateTrackedJobStatus(req.params.id as string, req.userId!, status);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Tracked job not found' });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

// PATCH /api/tracked-jobs/:id/notes - Update notes
router.patch('/:id/notes', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { notes } = req.body;
    if (notes === undefined) {
      res.status(400).json({ success: false, error: 'Notes field required' });
      return;
    }

    const updated = await jobService.updateTrackedJobNotes(req.params.id as string, req.userId!, notes);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Tracked job not found' });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to update notes' });
  }
});

// PATCH /api/tracked-jobs/:id - Update status and/or notes
router.patch('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, notes } = req.body;

    if (status && !validStatuses.includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid status' });
      return;
    }

    const updated = await jobService.updateTrackedJob(req.params.id as string, req.userId!, { status, notes });
    if (!updated) {
      res.status(404).json({ success: false, error: 'Tracked job not found' });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to update tracked job' });
  }
});

// DELETE /api/tracked-jobs/:id - Remove a tracked job
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await jobService.deleteTrackedJob(req.params.id as string, req.userId!);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to delete tracked job' });
  }
});

export default router;
