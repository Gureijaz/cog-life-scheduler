import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  errorMiddleware,
  AppError,
  validationError,
  unauthorizedError,
  notFoundError,
} from './error';

function mockRes(): Response & { _status: number; _body: unknown } {
  const res = {
    _status: 0,
    _body: undefined as unknown,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(body: unknown) {
      res._body = body;
      return res;
    },
  };
  return res as unknown as Response & { _status: number; _body: unknown };
}

const req = {} as Request;
const next = vi.fn() as NextFunction;

describe('AppError factory functions', () => {
  it('validationError creates a 400 AppError', () => {
    const err = validationError('Bad input', 'name', 'required', '');
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual({ field: 'name', reason: 'required', value: '' });
  });

  it('unauthorizedError creates a 401 AppError', () => {
    const err = unauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('notFoundError creates a 404 AppError with resource info', () => {
    const err = notFoundError('User', 'abc-123');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe("User with id 'abc-123' not found");
  });

  it('notFoundError works without resourceId', () => {
    const err = notFoundError('Schedule');
    expect(err.message).toBe('Schedule not found');
  });
});

describe('errorMiddleware', () => {
  it('handles AppError with details', () => {
    const err = new AppError(400, 'VALIDATION_ERROR', 'Invalid field', {
      field: 'email',
      reason: 'required',
    });
    const res = mockRes();

    errorMiddleware(err, req, res, next);

    expect(res._status).toBe(400);
    expect(res._body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid field',
        details: { field: 'email', reason: 'required' },
      },
    });
  });

  it('handles AppError without details', () => {
    const err = new AppError(401, 'UNAUTHORIZED', 'Auth required');
    const res = mockRes();

    errorMiddleware(err, req, res, next);

    expect(res._status).toBe(401);
    expect(res._body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Auth required',
      },
    });
  });

  it('handles 404 AppError', () => {
    const err = notFoundError('Task', 'xyz');
    const res = mockRes();

    errorMiddleware(err, req, res, next);

    expect(res._status).toBe(404);
    expect(res._body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: "Task with id 'xyz' not found",
      },
    });
  });

  it('handles JSON parse errors as 400', () => {
    const err = new SyntaxError('Unexpected token') as SyntaxError & { type: string };
    err.type = 'entity.parse.failed';
    const res = mockRes();

    errorMiddleware(err, req, res, next);

    expect(res._status).toBe(400);
    expect(res._body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid JSON in request body',
      },
    });
  });

  it('handles unexpected errors as 500', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('Something broke');
    const res = mockRes();

    errorMiddleware(err, req, res, next);

    expect(res._status).toBe(500);
    expect(res._body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
    consoleSpy.mockRestore();
  });
});
