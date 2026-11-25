import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser, type UserRecord } from '../db/queries.ts';

export interface AuthRequest extends Request {
  firebaseUser?: DecodedIdToken;
  dbUser?: UserRecord;
}

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return next();
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.firebaseUser = decoded;
    req.dbUser = await getOrCreateUser({
      uid: decoded.uid,
      email: decoded.email || `${decoded.uid}@users.storepulse.local`,
      name: decoded.name || (decoded.email ? decoded.email.split('@')[0] : 'StorePulse Member'),
    });
  } catch (err) {
    console.warn('Optional auth token ignored:', err instanceof Error ? err.message : 'invalid token');
  }

  next();
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Please sign in to continue.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Please sign in to continue.' });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.firebaseUser = decoded;
    req.dbUser = await getOrCreateUser({
      uid: decoded.uid,
      email: decoded.email || `${decoded.uid}@users.storepulse.local`,
      name: decoded.name || (decoded.email ? decoded.email.split('@')[0] : 'StorePulse Member'),
    });
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }
};

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.dbUser || req.dbUser.role !== 'SYSTEM_ADMIN') {
    return res.status(403).json({ error: 'Administrator permissions are required for this action.' });
  }
  next();
};

export const requireMerchantOrAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (
    !req.dbUser ||
    (req.dbUser.role !== 'STORE_OWNER' && req.dbUser.role !== 'SYSTEM_ADMIN')
  ) {
    return res.status(403).json({ error: 'Merchant or Administrator permissions are required.' });
  }
  next();
};
