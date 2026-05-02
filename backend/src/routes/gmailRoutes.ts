import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { GmailService } from '../services/gmailService';

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
    const userId = req.query.state as string; // We passed userId in state
    
    if (!code || !userId) {
      return res.status(400).send('Missing code or state parameters');
    }
    
    await gmailService.handleCallback(code, userId);
    
    // Redirect to frontend dashboard or settings
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/jobs`);
  } catch (err: any) {
    console.error('Error handling Gmail callback:', err);
    res.status(500).send('Authentication failed');
  }
});

export default router;
