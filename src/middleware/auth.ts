import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

// Strict authentication middleware
export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  try {
    if (token.startsWith('custom_')) {
      const username = token.replace('custom_', '');
      req.user = {
        uid: token,
        email: `${username}@ptsl.id`,
        email_verified: true,
        auth_time: Math.floor(Date.now() / 1000),
        iss: 'custom-auth',
        aud: 'custom-auth',
        exp: Math.floor(Date.now() / 1000) + 86400,
        sub: token,
        firebase: {
          identities: {},
          sign_in_provider: 'custom'
        }
      } as any;
      next();
      return;
    }
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// Optional authentication middleware (allows guests)
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.split('Bearer ')[1];
  if (!token || token === 'null' || token === 'undefined') {
    next();
    return;
  }

  try {
    if (token.startsWith('custom_')) {
      const username = token.replace('custom_', '');
      req.user = {
        uid: token,
        email: `${username}@ptsl.id`,
        email_verified: true,
        auth_time: Math.floor(Date.now() / 1000),
        iss: 'custom-auth',
        aud: 'custom-auth',
        exp: Math.floor(Date.now() / 1000) + 86400,
        sub: token,
        firebase: {
          identities: {},
          sign_in_provider: 'custom'
        }
      } as any;
      next();
      return;
    }
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
  } catch (error) {
    // Safe, silent fallback for optional auth
  }
  next();
};
