import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { InterviewRepository } from '../repositories/interviewRepository';
import { InterviewOutcome } from '../types';

const router = Router();
const repo = new InterviewRepository();

const validOutcomes: InterviewOutcome[] = ['pending', 'passed', 'failed', 'cancelled'];

// GET /api/interview-rounds?tracked_job_id=...
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const trackedJobId = req.query.tracked_job_id as string | undefined;
    if (!trackedJobId) {
      res.status(400).json({ success: false, error: 'tracked_job_id query param required' });
      return;
    }
    const rounds = await repo.listForTrackedJob(req.userId!, trackedJobId);
    res.json({ success: true, data: rounds });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch interview rounds' });
  }
});

// POST /api/interview-rounds
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { tracked_job_id, round_name, scheduled_at, interviewer, notes, outcome } = req.body;

    if (!tracked_job_id || typeof tracked_job_id !== 'string') {
      res.status(400).json({ success: false, error: 'tracked_job_id required' });
      return;
    }
    if (!round_name || typeof round_name !== 'string' || !round_name.trim()) {
      res.status(400).json({ success: false, error: 'round_name required' });
      return;
    }
    if (outcome && !validOutcomes.includes(outcome)) {
      res.status(400).json({ success: false, error: 'Invalid outcome' });
      return;
    }

    const created = await repo.create(req.userId!, {
      tracked_job_id,
      round_name: round_name.trim(),
      scheduled_at: scheduled_at || null,
      interviewer: interviewer || null,
      notes: notes || null,
      outcome,
    });
    res.json({ success: true, data: created });
  } catch (err: any) {
    if (err?.message === 'Tracked job not found') {
      res.status(404).json({ success: false, error: 'Tracked job not found' });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to create interview round' });
  }
});

// PATCH /api/interview-rounds/:id
router.patch('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { round_name, scheduled_at, interviewer, notes, outcome } = req.body;

    if (outcome && !validOutcomes.includes(outcome)) {
      res.status(400).json({ success: false, error: 'Invalid outcome' });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (round_name !== undefined) updates.round_name = round_name;
    if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at || null;
    if (interviewer !== undefined) updates.interviewer = interviewer || null;
    if (notes !== undefined) updates.notes = notes || null;
    if (outcome !== undefined) updates.outcome = outcome;

    const updated = await repo.update(req.userId!, req.params.id as string, updates);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Interview round not found' });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to update interview round' });
  }
});

// DELETE /api/interview-rounds/:id
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const ok = await repo.delete(req.userId!, req.params.id as string);
    if (!ok) {
      res.status(404).json({ success: false, error: 'Interview round not found' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to delete interview round' });
  }
});

export default router;
