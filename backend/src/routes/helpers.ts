import type { Request } from 'express';
import type { ErrorResponse } from '../types/api';

/**
 * Extract the authenticated userId from the request.
 * The auth middleware attaches it as req.userId.
 */
export function getUserId(req: Request): string {
  return (req as Request & { userId: string }).userId;
}

/**
 * Map service-layer ErrorResponse codes to HTTP status codes.
 * Services throw plain ErrorResponse objects (not Error instances).
 */
export function errorToStatus(err: ErrorResponse): number {
  const code = err.error.code;
  if (code === 'NOT_FOUND') return 404;
  if (code === 'UNAUTHORIZED') return 401;
  if (code === 'DATABASE_ERROR' || code === 'INTERNAL_ERROR') return 500;
  // All validation-related codes → 400
  return 400;
}

/**
 * Type guard: check if a thrown value is an ErrorResponse object.
 */
export function isErrorResponse(err: unknown): err is ErrorResponse {
  return (
    typeof err === 'object' &&
    err !== null &&
    'error' in err &&
    typeof (err as ErrorResponse).error === 'object' &&
    typeof (err as ErrorResponse).error.code === 'string'
  );
}
