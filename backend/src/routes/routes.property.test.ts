import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import express from 'express';
import type { Express } from 'express';
import { userRouter } from './users';
import { locationRouter } from './locations';
import { travelRuleRouter } from './travel-rules';
import { assignmentRouter } from './assignments';
import { scheduleRouter } from './schedules';
import type { UserService } from '../services/user';
import type { LocationService } from '../services/location';
import type { AssignmentService } from '../services/assignment';
import type { ScheduleService } from '../services/schedule';
import type { Server } from 'http';

// ─── Test Helpers ─────────────────────────────────────────────

function createApp(setup: (app: Express) => void): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).userId = 'test-user-1';
    next();
  });
  setup(app);
  return app;
}

function startServer(app: Express): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') { server.close(); reject(new Error('bad addr')); return; }
      resolve({ server, port: addr.port });
    });
  });
}

async function req(
  port: number,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: any }> {
  const url = `http://127.0.0.1:${port}${path}`;
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', 'x-user-id': 'test-user-1' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

function assertValidErrorResponse(body: any): void {
  expect(body).toHaveProperty('error');
  expect(body.error).toHaveProperty('code');
  expect(typeof body.error.code).toBe('string');
  expect(body.error).toHaveProperty('message');
  expect(typeof body.error.message).toBe('string');
}

// ─── Arbitraries for invalid payloads ─────────────────────────

/** Values that are NOT non-empty strings. */
const notNonEmptyStringArb = fc.oneof(
  fc.constant(undefined),
  fc.constant(null),
  fc.constant(''),
  fc.constant('   '),
  fc.integer(),
  fc.boolean(),
  fc.constant([]),
  fc.constant({}),
);

/** Values that are NOT numbers. */
const notNumberArb = fc.oneof(
  fc.constant(undefined),
  fc.constant(null),
  fc.constant('hello'),
  fc.boolean(),
  fc.constant([]),
  fc.constant({}),
);


// ─── Property 27: Invalid API Input Returns 400 ──────────────
// **Validates: Requirements 13.6**

describe('Property 27: Invalid API Input Returns 400', () => {
  // ── POST /api/users ───────────────────────────────────────

  describe('POST /api/users — missing or invalid fields', () => {
    let server: Server;
    let port: number;

    beforeAll(async () => {
      const mockUserService = {
        createUser: vi.fn().mockResolvedValue({ id: 'u1', name: 'A', email: 'a@b.com' }),
        getUser: vi.fn(),
        updatePreferences: vi.fn(),
      } as unknown as UserService;
      const app = createApp((a) => a.use('/api/users', userRouter(mockUserService)));
      ({ server, port } = await startServer(app));
    });

    afterAll(() => { server?.close(); });

    it('returns 400 when name is missing or not a non-empty string', async () => {
      await fc.assert(
        fc.asyncProperty(notNonEmptyStringArb, async (badName) => {
          const payload: any = { email: 'valid@example.com' };
          if (badName !== undefined) payload.name = badName;
          const res = await req(port, 'POST', '/api/users', payload);
          expect(res.status).toBe(400);
          assertValidErrorResponse(res.body);
          expect(res.body.error.details.field).toBe('name');
        }),
        { numRuns: 20 },
      );
    });

    it('returns 400 when email is missing or not a non-empty string', async () => {
      await fc.assert(
        fc.asyncProperty(notNonEmptyStringArb, async (badEmail) => {
          const payload: any = { name: 'Alice' };
          if (badEmail !== undefined) payload.email = badEmail;
          const res = await req(port, 'POST', '/api/users', payload);
          expect(res.status).toBe(400);
          assertValidErrorResponse(res.body);
          expect(res.body.error.details.field).toBe('email');
        }),
        { numRuns: 20 },
      );
    });
  });

  // ── POST /api/locations ───────────────────────────────────

  describe('POST /api/locations — missing or invalid fields', () => {
    let server: Server;
    let port: number;

    beforeAll(async () => {
      const mockLocationService = {
        createLocation: vi.fn().mockResolvedValue({ id: 'l1', name: 'Home', type: 'residence' }),
        createTravelRule: vi.fn(),
        updateTravelRule: vi.fn(),
        getTravelRules: vi.fn(),
      } as unknown as LocationService;
      const app = createApp((a) => a.use('/api/locations', locationRouter(mockLocationService)));
      ({ server, port } = await startServer(app));
    });

    afterAll(() => { server?.close(); });

    it('returns 400 when name is missing or not a non-empty string', async () => {
      await fc.assert(
        fc.asyncProperty(notNonEmptyStringArb, async (badName) => {
          const payload: any = { label: 'home', type: 'residence' };
          if (badName !== undefined) payload.name = badName;
          const res = await req(port, 'POST', '/api/locations', payload);
          expect(res.status).toBe(400);
          assertValidErrorResponse(res.body);
          expect(res.body.error.details.field).toBe('name');
        }),
        { numRuns: 20 },
      );
    });

    it('returns 400 when type is missing or not a non-empty string', async () => {
      await fc.assert(
        fc.asyncProperty(notNonEmptyStringArb, async (badType) => {
          const payload: any = { name: 'Home', label: 'home' };
          if (badType !== undefined) payload.type = badType;
          const res = await req(port, 'POST', '/api/locations', payload);
          expect(res.status).toBe(400);
          assertValidErrorResponse(res.body);
          expect(res.body.error.details.field).toBe('type');
        }),
        { numRuns: 20 },
      );
    });
  });

  // ── POST /api/travel-rules ────────────────────────────────

  describe('POST /api/travel-rules — missing or invalid fields', () => {
    let server: Server;
    let port: number;

    beforeAll(async () => {
      const mockLocationService = {
        createTravelRule: vi.fn().mockResolvedValue({ id: 'tr1', originId: 'l1', destinationId: 'l2', travelMinutes: 30 }),
        createLocation: vi.fn(),
        updateTravelRule: vi.fn(),
        getTravelRules: vi.fn(),
      } as unknown as LocationService;
      const app = createApp((a) => a.use('/api/travel-rules', travelRuleRouter(mockLocationService)));
      ({ server, port } = await startServer(app));
    });

    afterAll(() => { server?.close(); });

    it('returns 400 when originId is missing or not a string', async () => {
      await fc.assert(
        fc.asyncProperty(notNonEmptyStringArb, async (badOriginId) => {
          const payload: any = { destinationId: 'l2', travelMinutes: 30 };
          if (badOriginId !== undefined) payload.originId = badOriginId;
          const res = await req(port, 'POST', '/api/travel-rules', payload);
          expect(res.status).toBe(400);
          assertValidErrorResponse(res.body);
          expect(res.body.error.details.field).toBe('originId');
        }),
        { numRuns: 20 },
      );
    });

    it('returns 400 when destinationId is missing or not a string', async () => {
      await fc.assert(
        fc.asyncProperty(notNonEmptyStringArb, async (badDestId) => {
          const payload: any = { originId: 'l1', travelMinutes: 30 };
          if (badDestId !== undefined) payload.destinationId = badDestId;
          const res = await req(port, 'POST', '/api/travel-rules', payload);
          expect(res.status).toBe(400);
          assertValidErrorResponse(res.body);
          expect(res.body.error.details.field).toBe('destinationId');
        }),
        { numRuns: 20 },
      );
    });

    it('returns 400 when travelMinutes is missing or not a number', async () => {
      await fc.assert(
        fc.asyncProperty(notNumberArb, async (badMinutes) => {
          const payload: any = { originId: 'l1', destinationId: 'l2' };
          if (badMinutes !== undefined) payload.travelMinutes = badMinutes;
          const res = await req(port, 'POST', '/api/travel-rules', payload);
          expect(res.status).toBe(400);
          assertValidErrorResponse(res.body);
          expect(res.body.error.details.field).toBe('travelMinutes');
        }),
        { numRuns: 20 },
      );
    });
  });

  // ── PUT /api/assignments/:id/progress ─────────────────────

  describe('PUT /api/assignments/:id/progress — missing or invalid fields', () => {
    let server: Server;
    let port: number;

    beforeAll(async () => {
      const mockAssignmentService = {
        createAssignment: vi.fn(),
        getAssignmentsWithUrgency: vi.fn(),
        updateProgress: vi.fn().mockResolvedValue({ id: 'a1', progressPercent: 50 }),
      } as unknown as AssignmentService;
      const app = createApp((a) => a.use('/api/assignments', assignmentRouter(mockAssignmentService)));
      ({ server, port } = await startServer(app));
    });

    afterAll(() => { server?.close(); });

    it('returns 400 when progressPercent is missing or not a number', async () => {
      await fc.assert(
        fc.asyncProperty(notNumberArb, async (badProgress) => {
          const payload: any = {};
          if (badProgress !== undefined) payload.progressPercent = badProgress;
          const res = await req(port, 'PUT', '/api/assignments/a1/progress', payload);
          expect(res.status).toBe(400);
          assertValidErrorResponse(res.body);
          expect(res.body.error.details.field).toBe('progressPercent');
        }),
        { numRuns: 20 },
      );
    });
  });

  // ── POST /api/schedules/generate ──────────────────────────

  describe('POST /api/schedules/generate — missing or invalid fields', () => {
    let server: Server;
    let port: number;

    beforeAll(async () => {
      const mockScheduleService = {
        generateSchedule: vi.fn().mockResolvedValue({ plan: {}, unscheduledItems: [] }),
        repairSchedule: vi.fn(),
        getSchedulePlan: vi.fn(),
        getWeekPlan: vi.fn(),
        lockBlock: vi.fn(),
        unlockBlock: vi.fn(),
        getExplanation: vi.fn(),
      } as unknown as ScheduleService;
      const app = createApp((a) => a.use('/api/schedules', scheduleRouter(mockScheduleService)));
      ({ server, port } = await startServer(app));
    });

    afterAll(() => { server?.close(); });

    it('returns 400 when date is missing or not a string', async () => {
      await fc.assert(
        fc.asyncProperty(notNonEmptyStringArb, async (badDate) => {
          const payload: any = {};
          if (badDate !== undefined) payload.date = badDate;
          const res = await req(port, 'POST', '/api/schedules/generate', payload);
          expect(res.status).toBe(400);
          assertValidErrorResponse(res.body);
          expect(res.body.error.details.field).toBe('date');
        }),
        { numRuns: 20 },
      );
    });
  });
});
