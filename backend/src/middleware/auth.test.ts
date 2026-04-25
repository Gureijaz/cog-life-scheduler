import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from './auth';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    path: '/api/test',
    headers: {},
    ...overrides,
  } as unknown as Request;
}

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

describe('authMiddleware', () => {
  it('allows /health without authentication', () => {
    const req = mockReq({ path: '/health' });
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res._status).toBe(0);
  });

  it('rejects requests without x-user-id header with 401', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
    expect(res._body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
  });

  it('rejects requests with empty x-user-id header', () => {
    const req = mockReq({ headers: { 'x-user-id': '  ' } });
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
  });

  it('allows requests with valid x-user-id header', () => {
    const req = mockReq({ headers: { 'x-user-id': 'user-123' } });
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as Request & { userId?: string }).userId).toBe('user-123');
  });

  it('handles array x-user-id header by using first value', () => {
    const req = mockReq({
      headers: { 'x-user-id': ['user-a', 'user-b'] as unknown as string },
    });
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as Request & { userId?: string }).userId).toBe('user-a');
  });
});
