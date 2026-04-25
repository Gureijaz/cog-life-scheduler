import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Express } from 'express';
import { authMiddleware, errorMiddleware } from '../middleware';
import { userRouter } from './users';
import { fixedEventRouter } from './fixed-events';
import { flexibleTaskRouter } from './flexible-tasks';
import { assignmentRouter } from './assignments';
import { locationRouter } from './locations';
import { travelRuleRouter } from './travel-rules';
import { scheduleRouter } from './schedules';
import { scheduleBlockRouter } from './schedule-blocks';
import type { UserService } from '../services/user';
import type { EventService } from '../services/event';
import type { TaskService } from '../services/task';
import type { AssignmentService } from '../services/assignment';
import type { LocationService } from '../services/location';
import type { ScheduleService } from '../services/schedule';

// ─── Test Helpers ─────────────────────────────────────────────

/**
 * Creates a full Express app with real auth + error middleware,
 * matching the production wiring in index.ts.
 */
function createIntegrationApp(setup: (app: Express) => void): Express {
  const app = express();
  app.use(express.json());
  app.use(authMiddleware);
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  setup(app);
  app.use(errorMiddleware);
  return app;
}

async function request(
  app: Express,
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const server = app.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        reject(new Error('bad addr'));
        return;
      }
      const url = `http://127.0.0.1:${addr.port}${path}`;
      const opts: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
      };
      if (body !== undefined) opts.body = JSON.stringify(body);
      fetch(url, opts)
        .then(async (res) => {
          const text = await res.text();
          let json: any;
          try { json = JSON.parse(text); } catch { json = text; }
          server.close();
          resolve({ status: res.status, body: json });
        })
        .catch((err) => { server.close(); reject(err); });
    });
  });
}


// ─── Auth Middleware Integration ──────────────────────────────
// Validates: Requirements 13.7, 13.8

describe('Auth middleware integration', () => {
  let app: Express;

  beforeEach(() => {
    const mockUserService = {
      createUser: vi.fn().mockResolvedValue({ id: 'u1', name: 'Alice' }),
      getUser: vi.fn().mockResolvedValue({ id: 'u1', name: 'Alice' }),
      updatePreferences: vi.fn().mockResolvedValue({ id: 'p1' }),
    } as unknown as UserService;
    app = createIntegrationApp((a) => a.use('/api/users', userRouter(mockUserService)));
  });

  it('returns 401 when x-user-id header is missing', async () => {
    const res = await request(app, 'GET', '/api/users/u1');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toBe('Authentication required');
  });

  it('returns 401 when x-user-id header is empty string', async () => {
    const res = await request(app, 'GET', '/api/users/u1', undefined, { 'x-user-id': '' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when x-user-id header is whitespace only', async () => {
    const res = await request(app, 'GET', '/api/users/u1', undefined, { 'x-user-id': '   ' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('allows health endpoint without auth', async () => {
    const res = await request(app, 'GET', '/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('allows authenticated requests through', async () => {
    const res = await request(app, 'GET', '/api/users/u1', undefined, { 'x-user-id': 'test-user' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('u1');
  });

  it('returns 401 for POST without auth', async () => {
    const res = await request(app, 'POST', '/api/users', { name: 'Alice', email: 'a@b.com' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for PUT without auth', async () => {
    const res = await request(app, 'PUT', '/api/users/u1/preferences', { wakeTime: '07:00' });
    expect(res.status).toBe(401);
  });
});


// ─── Error Middleware Integration ─────────────────────────────
// Validates: Requirements 13.7, 13.8

describe('Error middleware integration', () => {
  it('maps NOT_FOUND service errors to 404', async () => {
    const mockUserService = {
      getUser: vi.fn().mockRejectedValue({
        error: { code: 'NOT_FOUND', message: 'User not found', details: { field: 'userId' } },
      }),
      createUser: vi.fn(),
      updatePreferences: vi.fn(),
    } as unknown as UserService;
    const app = createIntegrationApp((a) => a.use('/api/users', userRouter(mockUserService)));

    const res = await request(app, 'GET', '/api/users/missing', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('maps VALIDATION_ERROR service errors to 400', async () => {
    const mockUserService = {
      updatePreferences: vi.fn().mockRejectedValue({
        error: { code: 'INVALID_BUFFER', message: 'Min buffer must be >= 0', details: { field: 'minBufferMinutes' } },
      }),
      createUser: vi.fn(),
      getUser: vi.fn(),
    } as unknown as UserService;
    const app = createIntegrationApp((a) => a.use('/api/users', userRouter(mockUserService)));

    const res = await request(app, 'PUT', '/api/users/u1/preferences', { minBufferMinutes: -5 }, { 'x-user-id': 'u1' });
    expect(res.status).toBe(400);
  });

  it('maps DATABASE_ERROR service errors to 500', async () => {
    const mockUserService = {
      getUser: vi.fn().mockRejectedValue({
        error: { code: 'DATABASE_ERROR', message: 'Connection failed' },
      }),
      createUser: vi.fn(),
      updatePreferences: vi.fn(),
    } as unknown as UserService;
    const app = createIntegrationApp((a) => a.use('/api/users', userRouter(mockUserService)));

    const res = await request(app, 'GET', '/api/users/u1', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(500);
  });

  it('maps INTERNAL_ERROR service errors to 500', async () => {
    const mockUserService = {
      getUser: vi.fn().mockRejectedValue({
        error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
      }),
      createUser: vi.fn(),
      updatePreferences: vi.fn(),
    } as unknown as UserService;
    const app = createIntegrationApp((a) => a.use('/api/users', userRouter(mockUserService)));

    const res = await request(app, 'GET', '/api/users/u1', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});


// ─── User CRUD Integration ───────────────────────────────────
// Validates: Requirements 13.1

describe('User CRUD integration (full middleware chain)', () => {
  let mockUserService: UserService;
  let app: Express;

  beforeEach(() => {
    mockUserService = {
      createUser: vi.fn().mockResolvedValue({ id: 'u1', name: 'Alice', email: 'a@b.com', timezone: 'UTC', onboardingComplete: false }),
      getUser: vi.fn().mockResolvedValue({ id: 'u1', name: 'Alice', email: 'a@b.com', timezone: 'UTC' }),
      updatePreferences: vi.fn().mockResolvedValue({ id: 'p1', userId: 'u1', wakeTime: '07:00', sleepTime: '23:00' }),
    } as unknown as UserService;
    app = createIntegrationApp((a) => a.use('/api/users', userRouter(mockUserService)));
  });

  it('POST /api/users creates user with auth', async () => {
    const res = await request(app, 'POST', '/api/users', { name: 'Alice', email: 'a@b.com' }, { 'x-user-id': 'u1' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Alice');
  });

  it('GET /api/users/:id returns user with auth', async () => {
    const res = await request(app, 'GET', '/api/users/u1', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('u1');
  });

  it('PUT /api/users/:id/preferences updates preferences with auth', async () => {
    const res = await request(app, 'PUT', '/api/users/u1/preferences', { wakeTime: '07:00', sleepTime: '23:00' }, { 'x-user-id': 'u1' });
    expect(res.status).toBe(200);
    expect(res.body.wakeTime).toBe('07:00');
  });
});


// ─── Fixed Event CRUD Integration ────────────────────────────
// Validates: Requirements 13.1, 13.7, 12.4

describe('Fixed event CRUD integration (full middleware chain)', () => {
  let mockEventService: EventService;
  let app: Express;

  beforeEach(() => {
    mockEventService = {
      createFixedEvent: vi.fn().mockResolvedValue({ id: 'e1', title: 'Class', startTime: '09:00', endTime: '10:00' }),
      getFixedEventsForDate: vi.fn().mockResolvedValue([{ id: 'e1', title: 'Class' }]),
      updateFixedEvent: vi.fn().mockResolvedValue({ id: 'e1', title: 'Updated Class' }),
      updateRecurrenceInstance: vi.fn().mockResolvedValue({ id: 'e2', title: 'Instance Edit' }),
      deleteFixedEvent: vi.fn().mockResolvedValue(undefined),
    } as unknown as EventService;
    app = createIntegrationApp((a) => a.use('/api/fixed-events', fixedEventRouter(mockEventService)));
  });

  it('POST /api/fixed-events creates event with auth', async () => {
    const res = await request(app, 'POST', '/api/fixed-events', {
      title: 'Class', eventDate: '2025-01-20', startTime: '09:00', endTime: '10:00', category: 'school',
    }, { 'x-user-id': 'u1' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Class');
  });

  it('POST /api/fixed-events returns 401 without auth', async () => {
    const res = await request(app, 'POST', '/api/fixed-events', {
      title: 'Class', eventDate: '2025-01-20', startTime: '09:00', endTime: '10:00', category: 'school',
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/fixed-events?date= returns events', async () => {
    const res = await request(app, 'GET', '/api/fixed-events?date=2025-01-20', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/fixed-events without date returns 400', async () => {
    const res = await request(app, 'GET', '/api/fixed-events', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(400);
  });

  it('PUT /api/fixed-events/:id updates event', async () => {
    const res = await request(app, 'PUT', '/api/fixed-events/e1', { title: 'Updated Class' }, { 'x-user-id': 'u1' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Class');
  });

  it('PUT /api/fixed-events/:id/instances/:date updates recurrence instance', async () => {
    const res = await request(app, 'PUT', '/api/fixed-events/e1/instances/2025-01-20', { title: 'Instance Edit' }, { 'x-user-id': 'u1' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Instance Edit');
  });

  it('DELETE /api/fixed-events/:id deletes event', async () => {
    const res = await request(app, 'DELETE', '/api/fixed-events/e1', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(204);
  });

  it('DELETE /api/fixed-events/:id returns 404 for missing event', async () => {
    (mockEventService.deleteFixedEvent as any).mockRejectedValue({
      error: { code: 'NOT_FOUND', message: 'Event not found', details: { field: 'eventId' } },
    });
    const res = await request(app, 'DELETE', '/api/fixed-events/missing', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(404);
  });
});


// ─── Flexible Task CRUD Integration ──────────────────────────
// Validates: Requirements 13.1

describe('Flexible task CRUD integration (full middleware chain)', () => {
  let mockTaskService: TaskService;
  let app: Express;

  beforeEach(() => {
    mockTaskService = {
      createFlexibleTask: vi.fn().mockResolvedValue({ id: 't1', title: 'Study', estimatedMinutes: 60 }),
      getUnscheduledTasks: vi.fn().mockResolvedValue([{ id: 't1', title: 'Study' }]),
      updateFlexibleTask: vi.fn().mockResolvedValue({ id: 't1', title: 'Updated Study' }),
      deleteFlexibleTask: vi.fn().mockResolvedValue(undefined),
    } as unknown as TaskService;
    app = createIntegrationApp((a) => a.use('/api/flexible-tasks', flexibleTaskRouter(mockTaskService)));
  });

  it('POST /api/flexible-tasks creates task with auth', async () => {
    const res = await request(app, 'POST', '/api/flexible-tasks', {
      title: 'Study', category: 'school', estimatedMinutes: 60,
    }, { 'x-user-id': 'u1' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Study');
  });

  it('GET /api/flexible-tasks returns tasks with auth', async () => {
    const res = await request(app, 'GET', '/api/flexible-tasks', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('PUT /api/flexible-tasks/:id updates task', async () => {
    const res = await request(app, 'PUT', '/api/flexible-tasks/t1', { title: 'Updated Study' }, { 'x-user-id': 'u1' });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/flexible-tasks/:id deletes task', async () => {
    const res = await request(app, 'DELETE', '/api/flexible-tasks/t1', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(204);
  });

  it('DELETE /api/flexible-tasks/:id returns 404 for missing task', async () => {
    (mockTaskService.deleteFlexibleTask as any).mockRejectedValue({
      error: { code: 'NOT_FOUND', message: 'Task not found', details: { field: 'taskId' } },
    });
    const res = await request(app, 'DELETE', '/api/flexible-tasks/missing', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(404);
  });
});


// ─── Assignment CRUD Integration ─────────────────────────────
// Validates: Requirements 13.1

describe('Assignment CRUD integration (full middleware chain)', () => {
  let mockAssignmentService: AssignmentService;
  let app: Express;

  beforeEach(() => {
    mockAssignmentService = {
      createAssignment: vi.fn().mockResolvedValue({ id: 'a1', title: 'Essay', urgencyScore: 0.5 }),
      getAssignmentsWithUrgency: vi.fn().mockResolvedValue([{ id: 'a1', title: 'Essay', urgencyScore: 0.5 }]),
      updateProgress: vi.fn().mockResolvedValue({ id: 'a1', progressPercent: 50, urgencyScore: 0.3 }),
    } as unknown as AssignmentService;
    app = createIntegrationApp((a) => a.use('/api/assignments', assignmentRouter(mockAssignmentService)));
  });

  it('POST /api/assignments creates assignment with auth', async () => {
    const res = await request(app, 'POST', '/api/assignments', {
      title: 'Essay', subject: 'English', deadline: '2025-02-01T23:59:00Z', estimatedTotalMinutes: 120,
    }, { 'x-user-id': 'u1' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Essay');
  });

  it('GET /api/assignments returns assignments with urgency', async () => {
    const res = await request(app, 'GET', '/api/assignments', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].urgencyScore).toBe(0.5);
  });

  it('PUT /api/assignments/:id/progress updates progress', async () => {
    const res = await request(app, 'PUT', '/api/assignments/a1/progress', { progressPercent: 50 }, { 'x-user-id': 'u1' });
    expect(res.status).toBe(200);
    expect(res.body.progressPercent).toBe(50);
  });

  it('PUT /api/assignments/:id/progress returns 400 for missing progressPercent', async () => {
    const res = await request(app, 'PUT', '/api/assignments/a1/progress', {}, { 'x-user-id': 'u1' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.field).toBe('progressPercent');
  });

  it('PUT /api/assignments/:id with progressPercent delegates to updateProgress', async () => {
    const res = await request(app, 'PUT', '/api/assignments/a1', { progressPercent: 75 }, { 'x-user-id': 'u1' });
    expect(res.status).toBe(200);
    expect(mockAssignmentService.updateProgress).toHaveBeenCalledWith('a1', { progressPercent: 75 });
  });
});


// ─── Location & Travel Rule Integration ──────────────────────
// Validates: Requirements 13.1

describe('Location & travel rule integration (full middleware chain)', () => {
  let mockLocationService: LocationService;
  let app: Express;

  beforeEach(() => {
    mockLocationService = {
      createLocation: vi.fn().mockResolvedValue({ id: 'l1', name: 'Home', label: 'home', type: 'residence' }),
      createTravelRule: vi.fn().mockResolvedValue({ id: 'tr1', originId: 'l1', destinationId: 'l2', travelMinutes: 30 }),
      updateTravelRule: vi.fn().mockResolvedValue({ id: 'tr1', travelMinutes: 45 }),
      getTravelRules: vi.fn().mockResolvedValue([{ id: 'tr1', originId: 'l1', destinationId: 'l2', travelMinutes: 30 }]),
    } as unknown as LocationService;
    app = createIntegrationApp((a) => {
      a.use('/api/locations', locationRouter(mockLocationService));
      a.use('/api/travel-rules', travelRuleRouter(mockLocationService));
    });
  });

  it('POST /api/locations creates location with auth', async () => {
    const res = await request(app, 'POST', '/api/locations', { name: 'Home', label: 'home', type: 'residence' }, { 'x-user-id': 'u1' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Home');
  });

  it('POST /api/locations returns 400 for missing name', async () => {
    const res = await request(app, 'POST', '/api/locations', { type: 'residence' }, { 'x-user-id': 'u1' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.field).toBe('name');
  });

  it('POST /api/travel-rules creates rule with auth', async () => {
    const res = await request(app, 'POST', '/api/travel-rules', { originId: 'l1', destinationId: 'l2', travelMinutes: 30 }, { 'x-user-id': 'u1' });
    expect(res.status).toBe(201);
    expect(res.body.travelMinutes).toBe(30);
  });

  it('PUT /api/travel-rules/:id updates rule', async () => {
    const res = await request(app, 'PUT', '/api/travel-rules/tr1', { travelMinutes: 45 }, { 'x-user-id': 'u1' });
    expect(res.status).toBe(200);
    expect(res.body.travelMinutes).toBe(45);
  });

  it('GET /api/travel-rules returns rules', async () => {
    const res = await request(app, 'GET', '/api/travel-rules', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('PUT /api/travel-rules/:id returns 404 for missing rule', async () => {
    (mockLocationService.updateTravelRule as any).mockRejectedValue({
      error: { code: 'NOT_FOUND', message: 'Travel rule not found', details: { field: 'ruleId' } },
    });
    const res = await request(app, 'PUT', '/api/travel-rules/missing', { travelMinutes: 30 }, { 'x-user-id': 'u1' });
    expect(res.status).toBe(404);
  });
});


// ─── Schedule Generation & Repair Integration ────────────────
// Validates: Requirements 13.2, 13.3

describe('Schedule generation & repair integration (full middleware chain)', () => {
  let mockScheduleService: ScheduleService;
  let app: Express;

  beforeEach(() => {
    mockScheduleService = {
      generateSchedule: vi.fn().mockResolvedValue({
        plan: {
          id: 'sp1', userId: 'u1', planDate: '2025-01-20', version: 1,
          blocks: [
            { id: 'b1', planId: 'sp1', sourceType: 'fixed_event', title: 'Class', startTime: '09:00', endTime: '10:00', locked: false, sortOrder: 0 },
            { id: 'b2', planId: 'sp1', sourceType: 'flexible_task', title: 'Study', startTime: '10:30', endTime: '12:00', locked: false, sortOrder: 1 },
          ],
        },
        unscheduledItems: [],
        explanations: new Map(),
        atRiskAssignments: [],
      }),
      repairSchedule: vi.fn().mockResolvedValue({
        plan: {
          id: 'sp1', userId: 'u1', planDate: '2025-01-20', version: 2,
          blocks: [
            { id: 'b1', planId: 'sp1', sourceType: 'fixed_event', title: 'Class', startTime: '09:00', endTime: '10:00', locked: true, sortOrder: 0 },
            { id: 'b3', planId: 'sp1', sourceType: 'fixed_event', title: 'Meeting', startTime: '14:00', endTime: '15:00', locked: false, sortOrder: 2 },
          ],
        },
        unscheduledItems: [{ sourceType: 'flexible_task', title: 'Workout', reason: 'No available window' }],
        explanations: new Map(),
        atRiskAssignments: [],
        changeSummary: { moved: [], added: ['b3'], removed: ['b2'] },
      }),
      getSchedulePlan: vi.fn().mockResolvedValue({
        id: 'sp1', userId: 'u1', planDate: '2025-01-20', version: 1, blocks: [],
      }),
      getWeekPlan: vi.fn().mockResolvedValue([
        { id: 'sp1', userId: 'u1', planDate: '2025-01-20', version: 1, blocks: [] },
        { id: 'sp2', userId: 'u1', planDate: '2025-01-21', version: 1, blocks: [] },
      ]),
      lockBlock: vi.fn(),
      unlockBlock: vi.fn(),
      getExplanation: vi.fn(),
    } as unknown as ScheduleService;
    app = createIntegrationApp((a) => a.use('/api/schedules', scheduleRouter(mockScheduleService)));
  });

  it('POST /api/schedules/generate creates schedule with blocks', async () => {
    const res = await request(app, 'POST', '/api/schedules/generate', { date: '2025-01-20' }, { 'x-user-id': 'u1' });
    expect(res.status).toBe(201);
    expect(res.body.plan.blocks).toHaveLength(2);
    expect(res.body.plan.blocks[0].sourceType).toBe('fixed_event');
    expect(res.body.plan.blocks[1].sourceType).toBe('flexible_task');
    expect(mockScheduleService.generateSchedule).toHaveBeenCalledWith('u1', '2025-01-20');
  });

  it('POST /api/schedules/generate returns 401 without auth', async () => {
    const res = await request(app, 'POST', '/api/schedules/generate', { date: '2025-01-20' });
    expect(res.status).toBe(401);
  });

  it('POST /api/schedules/generate returns 400 for missing date', async () => {
    const res = await request(app, 'POST', '/api/schedules/generate', {}, { 'x-user-id': 'u1' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.field).toBe('date');
  });

  it('POST /api/schedules/:id/repair returns repair result with change summary', async () => {
    const change = { type: 'add', sourceType: 'fixed_event', date: '2025-01-20' };
    const res = await request(app, 'POST', '/api/schedules/sp1/repair', { change }, { 'x-user-id': 'u1' });
    expect(res.status).toBe(200);
    expect(res.body.changeSummary.added).toContain('b3');
    expect(res.body.changeSummary.removed).toContain('b2');
    expect(res.body.unscheduledItems).toHaveLength(1);
    expect(mockScheduleService.repairSchedule).toHaveBeenCalledWith('u1', 'sp1', change);
  });

  it('POST /api/schedules/:id/repair returns 400 for missing change', async () => {
    const res = await request(app, 'POST', '/api/schedules/sp1/repair', {}, { 'x-user-id': 'u1' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.field).toBe('change');
  });

  it('POST /api/schedules/:id/repair returns 404 for missing plan', async () => {
    (mockScheduleService.repairSchedule as any).mockRejectedValue({
      error: { code: 'NOT_FOUND', message: 'Schedule plan not found', details: { field: 'planId' } },
    });
    const res = await request(app, 'POST', '/api/schedules/missing/repair', {
      change: { type: 'add', sourceType: 'fixed_event', date: '2025-01-20' },
    }, { 'x-user-id': 'u1' });
    expect(res.status).toBe(404);
  });

  it('GET /api/schedules?date= returns schedule plan', async () => {
    const res = await request(app, 'GET', '/api/schedules?date=2025-01-20', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(200);
    expect(res.body.planDate).toBe('2025-01-20');
  });

  it('GET /api/schedules without date returns 400', async () => {
    const res = await request(app, 'GET', '/api/schedules', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(400);
  });

  it('GET /api/schedules/week?start= returns week plan', async () => {
    const res = await request(app, 'GET', '/api/schedules/week?start=2025-01-20', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it('GET /api/schedules/week without start returns 400', async () => {
    const res = await request(app, 'GET', '/api/schedules/week', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(400);
  });
});


// ─── Schedule Block Lock/Unlock & Explanation Integration ────
// Validates: Requirements 13.2, 13.3, 13.7

describe('Schedule block lock/unlock & explanation integration (full middleware chain)', () => {
  let mockScheduleService: ScheduleService;
  let app: Express;

  beforeEach(() => {
    mockScheduleService = {
      lockBlock: vi.fn().mockResolvedValue({ id: 'b1', locked: true, title: 'Class', startTime: '09:00', endTime: '10:00' }),
      unlockBlock: vi.fn().mockResolvedValue({ id: 'b1', locked: false, title: 'Class', startTime: '09:00', endTime: '10:00' }),
      getExplanation: vi.fn().mockResolvedValue({
        id: 'ex1', blockId: 'b1',
        explanationText: 'Placed as Fixed_Event hard constraint. Travel_Rule between Home and University required 15-minute buffer.',
        referencedConstraints: ['Fixed_Event', 'Travel_Rule'],
      }),
      generateSchedule: vi.fn(),
      repairSchedule: vi.fn(),
      getSchedulePlan: vi.fn(),
      getWeekPlan: vi.fn(),
    } as unknown as ScheduleService;
    app = createIntegrationApp((a) => a.use('/api/schedule-blocks', scheduleBlockRouter(mockScheduleService)));
  });

  it('PUT /api/schedule-blocks/:id/lock locks a block', async () => {
    const res = await request(app, 'PUT', '/api/schedule-blocks/b1/lock', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(200);
    expect(res.body.locked).toBe(true);
    expect(mockScheduleService.lockBlock).toHaveBeenCalledWith('b1');
  });

  it('PUT /api/schedule-blocks/:id/unlock unlocks a block', async () => {
    const res = await request(app, 'PUT', '/api/schedule-blocks/b1/unlock', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(200);
    expect(res.body.locked).toBe(false);
    expect(mockScheduleService.unlockBlock).toHaveBeenCalledWith('b1');
  });

  it('PUT /api/schedule-blocks/:id/lock returns 401 without auth', async () => {
    const res = await request(app, 'PUT', '/api/schedule-blocks/b1/lock');
    expect(res.status).toBe(401);
  });

  it('PUT /api/schedule-blocks/:id/lock returns 404 for missing block', async () => {
    (mockScheduleService.lockBlock as any).mockRejectedValue({
      error: { code: 'NOT_FOUND', message: 'Block not found', details: { field: 'blockId' } },
    });
    const res = await request(app, 'PUT', '/api/schedule-blocks/missing/lock', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(404);
  });

  it('PUT /api/schedule-blocks/:id/unlock returns 404 for missing block', async () => {
    (mockScheduleService.unlockBlock as any).mockRejectedValue({
      error: { code: 'NOT_FOUND', message: 'Block not found', details: { field: 'blockId' } },
    });
    const res = await request(app, 'PUT', '/api/schedule-blocks/missing/unlock', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(404);
  });

  it('GET /api/schedule-blocks/:id/explanation returns explanation', async () => {
    const res = await request(app, 'GET', '/api/schedule-blocks/b1/explanation', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(200);
    expect(res.body.explanationText).toContain('Fixed_Event');
    expect(res.body.explanationText).toContain('Travel_Rule');
    expect(res.body.referencedConstraints).toContain('Fixed_Event');
  });

  it('GET /api/schedule-blocks/:id/explanation returns 404 for missing block', async () => {
    (mockScheduleService.getExplanation as any).mockRejectedValue({
      error: { code: 'NOT_FOUND', message: 'Explanation not found', details: { field: 'blockId' } },
    });
    const res = await request(app, 'GET', '/api/schedule-blocks/missing/explanation', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(404);
  });
});


// ─── Event Deletion Cascade Integration ──────────────────────
// Validates: Requirements 12.4, 12.5

describe('Event deletion cascade integration', () => {
  it('deleteFixedEvent service is called and returns 204, simulating cascade to schedule blocks', async () => {
    const deleteFixedEvent = vi.fn().mockResolvedValue(undefined);
    const mockEventService = {
      createFixedEvent: vi.fn(),
      getFixedEventsForDate: vi.fn(),
      updateFixedEvent: vi.fn(),
      updateRecurrenceInstance: vi.fn(),
      deleteFixedEvent,
    } as unknown as EventService;
    const app = createIntegrationApp((a) => a.use('/api/fixed-events', fixedEventRouter(mockEventService)));

    const res = await request(app, 'DELETE', '/api/fixed-events/e1', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(204);
    expect(deleteFixedEvent).toHaveBeenCalledWith('e1');
  });

  it('deleteFlexibleTask service is called and returns 204', async () => {
    const deleteFlexibleTask = vi.fn().mockResolvedValue(undefined);
    const mockTaskService = {
      createFlexibleTask: vi.fn(),
      getUnscheduledTasks: vi.fn(),
      updateFlexibleTask: vi.fn(),
      deleteFlexibleTask,
    } as unknown as TaskService;
    const app = createIntegrationApp((a) => a.use('/api/flexible-tasks', flexibleTaskRouter(mockTaskService)));

    const res = await request(app, 'DELETE', '/api/flexible-tasks/t1', undefined, { 'x-user-id': 'u1' });
    expect(res.status).toBe(204);
    expect(deleteFlexibleTask).toHaveBeenCalledWith('t1');
  });
});


// ─── Preference & Priority Propagation Integration ───────────
// Validates: Requirements 13.1, 13.2

describe('Preference & priority propagation integration', () => {
  it('preference update followed by schedule generation passes updated userId', async () => {
    const updatePreferences = vi.fn().mockResolvedValue({
      id: 'p1', userId: 'u1', wakeTime: '06:00', sleepTime: '22:00',
      minBufferMinutes: 10, maxDeepWorkMinutes: 120, autoRepairEnabled: true,
    });
    const generateSchedule = vi.fn().mockResolvedValue({
      plan: { id: 'sp1', userId: 'u1', planDate: '2025-01-20', version: 1, blocks: [] },
      unscheduledItems: [],
      explanations: new Map(),
      atRiskAssignments: [],
    });

    const mockUserService = {
      createUser: vi.fn(),
      getUser: vi.fn(),
      updatePreferences,
    } as unknown as UserService;
    const mockScheduleService = {
      generateSchedule,
      repairSchedule: vi.fn(),
      getSchedulePlan: vi.fn(),
      getWeekPlan: vi.fn(),
      lockBlock: vi.fn(),
      unlockBlock: vi.fn(),
      getExplanation: vi.fn(),
    } as unknown as ScheduleService;

    const app = createIntegrationApp((a) => {
      a.use('/api/users', userRouter(mockUserService));
      a.use('/api/schedules', scheduleRouter(mockScheduleService));
    });

    // Update preferences
    const prefRes = await request(app, 'PUT', '/api/users/u1/preferences', {
      wakeTime: '06:00', sleepTime: '22:00', autoRepairEnabled: true,
    }, { 'x-user-id': 'u1' });
    expect(prefRes.status).toBe(200);
    expect(updatePreferences).toHaveBeenCalledWith('u1', {
      wakeTime: '06:00', sleepTime: '22:00', autoRepairEnabled: true,
    });

    // Generate schedule — service receives the same userId
    const schedRes = await request(app, 'POST', '/api/schedules/generate', { date: '2025-01-20' }, { 'x-user-id': 'u1' });
    expect(schedRes.status).toBe(201);
    expect(generateSchedule).toHaveBeenCalledWith('u1', '2025-01-20');
  });
});


// ─── Cross-cutting: Auth required on all entity endpoints ────
// Validates: Requirements 13.8

describe('Auth required on all entity endpoints', () => {
  let app: Express;

  beforeEach(() => {
    const noop = vi.fn();
    const mockServices = {
      userService: { createUser: noop, getUser: noop, updatePreferences: noop } as unknown as UserService,
      eventService: { createFixedEvent: noop, getFixedEventsForDate: noop, updateFixedEvent: noop, updateRecurrenceInstance: noop, deleteFixedEvent: noop } as unknown as EventService,
      taskService: { createFlexibleTask: noop, getUnscheduledTasks: noop, updateFlexibleTask: noop, deleteFlexibleTask: noop } as unknown as TaskService,
      assignmentService: { createAssignment: noop, getAssignmentsWithUrgency: noop, updateProgress: noop } as unknown as AssignmentService,
      locationService: { createLocation: noop, createTravelRule: noop, updateTravelRule: noop, getTravelRules: noop } as unknown as LocationService,
      scheduleService: { generateSchedule: noop, repairSchedule: noop, getSchedulePlan: noop, getWeekPlan: noop, lockBlock: noop, unlockBlock: noop, getExplanation: noop } as unknown as ScheduleService,
    };

    app = createIntegrationApp((a) => {
      a.use('/api/users', userRouter(mockServices.userService));
      a.use('/api/fixed-events', fixedEventRouter(mockServices.eventService));
      a.use('/api/flexible-tasks', flexibleTaskRouter(mockServices.taskService));
      a.use('/api/assignments', assignmentRouter(mockServices.assignmentService));
      a.use('/api/locations', locationRouter(mockServices.locationService));
      a.use('/api/travel-rules', travelRuleRouter(mockServices.locationService));
      a.use('/api/schedules', scheduleRouter(mockServices.scheduleService));
      a.use('/api/schedule-blocks', scheduleBlockRouter(mockServices.scheduleService));
    });
  });

  const unauthEndpoints: [string, string][] = [
    ['GET', '/api/users/u1'],
    ['POST', '/api/users'],
    ['PUT', '/api/users/u1/preferences'],
    ['POST', '/api/fixed-events'],
    ['GET', '/api/fixed-events?date=2025-01-20'],
    ['DELETE', '/api/fixed-events/e1'],
    ['POST', '/api/flexible-tasks'],
    ['GET', '/api/flexible-tasks'],
    ['DELETE', '/api/flexible-tasks/t1'],
    ['POST', '/api/assignments'],
    ['GET', '/api/assignments'],
    ['PUT', '/api/assignments/a1/progress'],
    ['POST', '/api/locations'],
    ['POST', '/api/travel-rules'],
    ['GET', '/api/travel-rules'],
    ['POST', '/api/schedules/generate'],
    ['GET', '/api/schedules?date=2025-01-20'],
    ['GET', '/api/schedules/week?start=2025-01-20'],
    ['PUT', '/api/schedule-blocks/b1/lock'],
    ['PUT', '/api/schedule-blocks/b1/unlock'],
    ['GET', '/api/schedule-blocks/b1/explanation'],
  ];

  it.each(unauthEndpoints)('%s %s returns 401 without auth', async (method, path) => {
    const res = await request(app, method, path, method === 'GET' || method === 'DELETE' ? undefined : {});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
