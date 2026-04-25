import type { Request, Response, NextFunction } from 'express';
import type { ErrorResponse } from '../types';

/**
 * Authentication middleware for the Cog Life Scheduler.
 *
 * This is a single-user application. Authentication is handled via
 * an `x-user-id` header. Requests without this header are rejected
 * with HTTP 401.
 *
 * The health endpoint is excluded from authentication.
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Allow health check without auth
  if (req.path === '/health') {
    next();
    return;
  }

  const userId = req.headers['x-user-id'];

  if (!userId || (typeof userId === 'string' && userId.trim() === '')) {
    const error: ErrorResponse = {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    };
    res.status(401).json(error);
    return;
  }

  // Attach userId to request for downstream use
  (req as Request & { userId?: string }).userId = Array.isArray(userId)
    ? userId[0]
    : userId;

  next();
}
