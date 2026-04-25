import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';

// Extend Express Request with user info
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

/**
 * Middleware to authenticate users via Supabase JWT token.
 * Extracts user ID from the Bearer token in the Authorization header.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    req.userId = user.id;
    req.userEmail = user.email;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ success: false, error: 'Authentication failed' });
  }
}

/**
 * Middleware to authenticate admin users via a simple password check.
 * Expects the admin token in the x-admin-token header.
 */
export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  const adminToken = req.headers['x-admin-token'] as string;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    res.status(500).json({ success: false, error: 'Admin password not configured' });
    return;
  }

  if (!adminToken || adminToken !== adminPassword) {
    res.status(403).json({ success: false, error: 'Unauthorized: invalid admin credentials' });
    return;
  }

  next();
}
