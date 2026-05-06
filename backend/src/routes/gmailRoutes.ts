import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { GmailService } from '../services/gmailService';
import { supabaseAdmin } from '../config/supabase';

const router = Router();
const gmailService = new GmailService();

// GET /api/gmail/auth - Get OAuth URL
router.get('/auth', authMiddleware, (req: Request, res: Response) => {
  const url = gmailService.getAuthUrl(req.userId!);
  res.json({ success: true, url });
});

// GET /api/gmail/callback - OAuth callback
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const userId = req.query.state as string;

    if (!code || !userId) {
      return res.status(400).send('Missing code or state parameters');
    }

    await gmailService.handleCallback(code, userId);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/jobs`);
  } catch (err: any) {
    console.error('Error handling Gmail callback:', err);
    res.status(500).send('Authentication failed');
  }
});

// GET /api/gmail/tracked-senders
router.get('/tracked-senders', authMiddleware, async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('user_tracked_senders')
    .select('*')
    .eq('user_id', req.userId!)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, data });
});

// POST /api/gmail/tracked-senders
router.post('/tracked-senders', authMiddleware, async (req: Request, res: Response) => {
  const { email, label } = req.body;
  if (!email) return res.status(400).json({ success: false, error: 'email is required' });

  const { data, error } = await supabaseAdmin
    .from('user_tracked_senders')
    .insert({ user_id: req.userId!, email: (email as string).toLowerCase().trim(), label: label || null })
    .select()
    .single();

  if (error) return res.status(400).json({ success: false, error: error.message });
  res.json({ success: true, data });
});

// DELETE /api/gmail/tracked-senders/:id
router.delete('/tracked-senders/:id', authMiddleware, async (req: Request, res: Response) => {
  const { error } = await supabaseAdmin
    .from('user_tracked_senders')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.userId!);

  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true });
});

export default router;
