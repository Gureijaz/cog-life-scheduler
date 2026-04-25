import type { Request, Response, NextFunction } from 'express';
import type { ErrorResponse } from '../types';

/**
 * Custom error class for application errors with HTTP status codes.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: {
    field?: string;
    reason?: string;
    value?: unknown;
  };

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: { field?: string; reason?: string; value?: unknown }
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/** 400 — Validation error */
export function validationError(
  message: string,
  field?: string,
  reason?: string,
  value?: unknown
): AppError {
  return new AppError(400, 'VALIDATION_ERROR', message, { field, reason, value });
}

/** 401 — Unauthorized */
export function unauthorizedError(message = 'Authentication required'): AppError {
  return new AppError(401, 'UNAUTHORIZED', message);
}

/** 404 — Not found */
export function notFoundError(
  resourceType: string,
  resourceId?: string
): AppError {
  const message = resourceId
    ? `${resourceType} with id '${resourceId}' not found`
    : `${resourceType} not found`;
  return new AppError(404, 'NOT_FOUND', message);
}

/**
 * Express error-handling middleware.
 *
 * Catches all errors and returns structured JSON responses matching
 * the ErrorResponse format defined in the API types.
 */
export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    const body: ErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  // Catch JSON parse errors from express.json()
  if ((err as unknown as Record<string, unknown>).type === 'entity.parse.failed') {
    const body: ErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid JSON in request body',
      },
    };
    res.status(400).json(body);
    return;
  }

  // Fallback: unexpected errors → 500
  console.error('Unhandled error:', err);
  const body: ErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  };
  res.status(500).json(body);
}
