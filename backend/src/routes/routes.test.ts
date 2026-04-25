import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Express } from 'express';
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

// Lightweight supertest-style helper using native fetch on the test server
function createTestApp(setup: (app: Express) => void): Express {
  const app = express();
  app.use(express.json());
  // Simulate auth middleware: attach userId from header
  app.use((req, _res, next) => {
    const userId = req.headers['x-user-id'];
    if (userId) {
      (req as any).userId = Array.isArray(userId) ? userId[0] : userId;
    }
    next();
  });
  setup(app);
  return app;
}

async function request(app: Express, method: string, path: string, body?: unknown, headers?: Record<string, string>) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const server = app.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') { server.close(); reject(new Error('bad addr')); return; }
      const url = `http://127.0.0.1:${addr.port}${path}`;
      const opts: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'test-user-1', ...headers },
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

// ─── User Routes ──────────────────────────────────────────────

describe('User routes', () => {
  let mockUserService: UserService;
  let app: Express;

  beforeEach(() => {
    mockUserService = {
      createUser: vi.fn().mockResolvedValue({ id: 'u1', name: 'Alice', email: 'a@b.com', timezone: 'UTC', onboardingComplete: false }),
      getUser: vi.fn().mockResolvedValue({ id: 'u1', name: 'Alice', email: 'a@b.com', timezone: 'UTC' }),
      updatePreferences: vi.fn().mockResolvedValue({ id: 'p1', userId: 'u1', wakeTime: '07:00', sleepTime: '23:00' }),
    } as unknown as UserService;
    app = createTestApp((a) => a.use('/api/users', userRouter(mockUserService)));
  });

  it('POST /api/users creates a user', async () => {
    const res = await request(app, 'POST', '/api/users', { name: 'Alice', email: 'a@b.com' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Alice');
    expect(mockUserService.createUser).toHaveBeenCalledWith({ name: 'Alice', email: 'a@b.com', timezone: undefined });
  });

  it('POST /api/users returns 400 for missing name', async () => {
    const res = await request(app, 'POST', '/api/users', { email: 'a@b.com' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.field).toBe('name');
  });

  it('POST /api/users returns 400 for missing email', async () => {
    const res = await request(app, 'POST', '/api/users', { name: 'Alice' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.field).toBe('email');
  });

  it('GET /api/users/:id returns user', async () => {
    const res = await request(app, 'GET', '/api/users/u1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('u1');
  });

  it('GET /api/users/:id returns 404 for missing user', async () => {
    (mockUserService.getUser as any).mockRejectedValue({
      error: { code: 'NOT_FOUND', message: 'User not found', details: { field: 'userId' } },
    });
    const res = await request(app, 'GET', '/api/users/missing');
    expect(res.status).toBe(404);
  });

  it('PUT /api/users/:id/preferences updates preferences', async () => {
    const res = await request(app, 'PUT', '/api/users/u1/preferences', { wakeTime: '07:00', sleepTime: '23:00' });
    expect(res.status).toBe(200);
    expect(res.body.wakeTime).toBe('07:00');
  });

  it('PUT /api/users/:id/preferences returns 400 for invalid input', async () => {
    (mockUserService.updatePreferences as any).mockRejectedValue({
      error: { code: 'INVALID_BUFFER', message: 'Min buffer must be >= 0', details: { field: 'minBufferMinutes' } },
    });
    const res = await request(app, 'PUT', '/api/users/u1/preferences', { minBufferMinutes: -5 });
    expect(res.status).toBe(400);
  });
});

// ─── Fixed Event Routes ───────────────────────────────────────

describe('Fixed event routes', () => {
  let mockEventService: EventService;
  let app: Express;

  beforeEach(() => {
    mockEventService = {
      createFixedEvent: vi.fn().mockResolvedValue({ id: 'e1', title: 'Class', startTime: '09:00', endTime: '10:00' }),
      getFixedEventsForDate: vi.fn().mockResolvedValue([{ id: 'e1', title: 'Class' }]),
      updateFixedEvent: vi.fn().mockResolvedValue({ id: 'e1', title: 'Updated' }),
      updateRecurrenceInstance: vi.fn().mockResolvedValue({ id: 'e2', title: 'Instance' }),
      deleteFixedEvent: vi.fn().mockResolvedValue(undefined),
    } as unknown as EventService;
    app = createTestApp((a) => a.use('/api/fixed-events', fixedEventRouter(mockEventService)));
  });

  it('POST /api/fixed-events creates an event', async () => {
    const res = await request(app, 'POST', '/api/fixed-events', {
      title: 'Class', eventDate: '2025-01-20', startTime: '09:00', endTime: '10:00', category: 'school',
    });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Class');
  });

  it('GET /api/fixed-events?date= returns events', async () => {
    const res = await request(app, 'GET', '/api/fixed-events?date=2025-01-20');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/fixed-events without date returns 400', async () => {
    const res = await request(app, 'GET', '/api/fixed-events');
    expect(res.status).toBe(400);
    expect(res.body.error.details.field).toBe('date');
  });

  it('PUT /api/fixed-events/:id updates event', async () => {
    const res = await request(app, 'PUT', '/api/fixed-events/e1', { title: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('PUT /api/fixed-events/:id/instances/:date updates instance', async () => {
    const res = await request(app, 'PUT', '/api/fixed-events/e1/instances/2025-01-20', { title: 'Instance' });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/fixed-events/:id deletes event', async () => {
    const res = await request(app, 'DELETE', '/api/fixed-events/e1');
    expect(res.status).toBe(204);
  });

  it('DELETE /api/fixed-events/:id returns 404 for missing event', async () => {
    (mockEventService.deleteFixedEvent as any).mockRejectedValue({
      error: { code: 'NOT_FOUND', message: 'Event not found', details: { field: 'eventId' } },
    });
    const res = await request(app, 'DELETE', '/api/fixed-events/missing');
    expect(res.status).toBe(404);
  });
});

// ─── Flexible Task Routes ─────────────────────────────────────

describe('Flexible task routes', () => {
  let mockTaskService: TaskService;
  let app: Express;

  beforeEach(() => {
    mockTaskService = {
      createFlexibleTask: vi.fn().mockResolvedValue({ id: 't1', title: 'Study', estimatedMinutes: 60 }),
      getUnscheduledTasks: vi.fn().mockResolvedValue([{ id: 't1', title: 'Study' }]),
      updateFlexibleTask: vi.fn().mockResolvedValue({ id: 't1', title: 'Updated' }),
      deleteFlexibleTask: vi.fn().mockResolvedValue(undefined),
    } as unknown as TaskService;
    app = createTestApp((a) => a.use('/api/flexible-tasks', flexibleTaskRouter(mockTaskService)));
  });

  it('POST /api/flexible-tasks creates a task', async () => {
    const res = await request(app, 'POST', '/api/flexible-tasks', {
      title: 'Study', category: 'school', estimatedMinutes: 60,
    });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Study');
  });

  it('GET /api/flexible-tasks returns unscheduled tasks', async () => {
    const res = await request(app, 'GET', '/api/flexible-tasks');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('PUT /api/flexible-tasks/:id updates task', async () => {
    const res = await request(app, 'PUT', '/api/flexible-tasks/t1', { title: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/flexible-tasks/:id deletes task', async () => {
    const res = await request(app, 'DELETE', '/api/flexible-tasks/t1');
    expect(res.status).toBe(204);
  });
});

// ─── Assignment Routes ────────────────────────────────────────

describe('Assignment routes', () => {
  let mockAssignmentService: AssignmentService;
  let app: Express;

  beforeEach(() => {
    mockAssignmentService = {
      createAssignment: vi.fn().mockResolvedValue({ id: 'a1', title: 'Essay', urgencyScore: 0.5 }),
      getAssignmentsWithUrgency: vi.fn().mockResolvedValue([{ id: 'a1', title: 'Essay' }]),
      updateProgress: vi.fn().mockResolvedValue({ id: 'a1', progressPercent: 50 }),
    } as unknown as AssignmentService;
    app = createTestApp((a) => a.use('/api/assignments', assignmentRouter(mockAssignmentService)));
  });

  it('POST /api/assignments creates an assignment', async () => {
    const res = await request(app, 'POST', '/api/assignments', {
      title: 'Essay', subject: 'English', deadline: '2025-02-01T23:59:00Z', estimatedTotalMinutes: 120,
    });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Essay');
  });

  it('GET /api/assignments returns assignments', async () => {
    const res = await request(app, 'GET', '/api/assignments');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('PUT /api/assignments/:id/progress updates progress', async () => {
    const res = await request(app, 'PUT', '/api/assignments/a1/progress', { progressPercent: 50 });
    expect(res.status).toBe(200);
    expect(res.body.progressPercent).toBe(50);
  });

  it('PUT /api/assignments/:id/progress returns 400 for missing progressPercent', async () => {
    const res = await request(app, 'PUT', '/api/assignments/a1/progress', {});
    expect(res.status).toBe(400);
    expect(res.body.error.details.field).toBe('progressPercent');
  });

  it('PUT /api/assignments/:id with progressPercent delegates to updateProgress', async () => {
    const res = await request(app, 'PUT', '/api/assignments/a1', { progressPercent: 75 });
    expect(res.status).toBe(200);
    expect(mockAssignmentService.updateProgress).toHaveBeenCalledWith('a1', { progressPercent: 75 });
  });
});

// ─── Location Routes ──────────────────────────────────────────

describe('Location routes', () => {
  let mockLocationService: LocationService;
  let app: Express;

  beforeEach(() => {
    mockLocationService = {
      createLocation: vi.fn().mockResolvedValue({ id: 'l1', name: 'Home', label: 'home', type: 'residence' }),
    } as unknown as LocationService;
    app = createTestApp((a) => a.use('/api/locations', locationRouter(mockLocationService)));
  });

  it('POST /api/locations creates a location', async () => {
    const res = await request(app, 'POST', '/api/locations', { name: 'Home', label: 'home', type: 'residence' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Home');
  });

  it('POST /api/locations returns 400 for missing name', async () => {
    const res = await request(app, 'POST', '/api/locations', { label: 'home', type: 'residence' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.field).toBe('name');
  });

  it('POST /api/locations returns 400 for missing type', async () => {
    const res = await request(app, 'POST', '/api/locations', { name: 'Home', label: 'home' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.field).toBe('type');
  });
});

// ─── Travel Rule Routes ───────────────────────────────────────

describe('Travel rule routes', () => {
  let mockLocationService: LocationService;
  let app: Express;

  beforeEach(() => {
    mockLocationService = {
      createTravelRule: vi.fn().mockResolvedValue({ id: 'tr1', originId: 'l1', destinationId: 'l2', travelMinutes: 30 }),
      updateTravelRule: vi.fn().mockResolvedValue({ id: 'tr1', travelMinutes: 45 }),
      getTravelRules: vi.fn().mockResolvedValue([{ id: 'tr1', originId: 'l1', destinationId: 'l2', travelMinutes: 30 }]),
    } as unknown as LocationService;
    app = createTestApp((a) => a.use('/api/travel-rules', travelRuleRouter(mockLocationService)));
  });

  it('POST /api/travel-rules creates a rule', async () => {
    const res = await request(app, 'POST', '/api/travel-rules', { originId: 'l1', destinationId: 'l2', travelMinutes: 30 });
    expect(res.status).toBe(201);
    expect(res.body.travelMinutes).toBe(30);
  });

  it('POST /api/travel-rules returns 400 for missing originId', async () => {
    const res = await request(app, 'POST', '/api/travel-rules', { destinationId: 'l2', travelMinutes: 30 });
    expect(res.status).toBe(400);
    expect(res.body.error.details.field).toBe('originId');
  });

  it('POST /api/travel-rules returns 400 for missing travelMinutes', async () => {
    const res = await request(app, 'POST', '/api/travel-rules', { originId: 'l1', destinationId: 'l2' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.field).toBe('travelMinutes');
  });

  it('PUT /api/travel-rules/:id updates rule', async () => {
    const res = await request(app, 'PUT', '/api/travel-rules/tr1', { travelMinutes: 45 });
    expect(res.status).toBe(200);
    expect(res.body.travelMinutes).toBe(45);
  });

  it('PUT /api/travel-rules/:id returns 400 for missing travelMinutes', async () => {
    const res = await request(app, 'PUT', '/api/travel-rules/tr1', {});
    expect(res.status).toBe(400);
  });

  it('GET /api/travel-rules returns rules', async () => {
    const res = await request(app, 'GET', '/api/travel-rules');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('PUT /api/travel-rules/:id returns 404 for missing rule', async () => {
    (mockLocationService.updateTravelRule as any).mockRejectedValue({
      error: { code: 'NOT_FOUND', message: 'Travel rule not found', details: { field: 'ruleId' } },
    });
    const res = await request(app, 'PUT', '/api/travel-rules/missing', { travelMinutes: 30 });
    expect(res.status).toBe(404);
  });
});


// ─── Schedule Routes ──────────────────────────────────────────

describe('Schedule routes', () => {
  let mockScheduleService: ScheduleService;
  let app: Express;

  beforeEach(() => {
    mockScheduleService = {
      generateSchedule: vi.fn().mockResolvedValue({
        plan: { id: 'sp1', userId: 'test-user-1', planDate: '2025-01-20', version: 1, blocks: [] },
        unscheduledItems: [],
        explanations: new Map(),
        atRiskAssignments: [],
      }),
      repairSchedule: vi.fn().mockResolvedValue({
        plan: { id: 'sp1', userId: 'test-user-1', planDate: '2025-01-20', version: 2, blocks: [] },
        unscheduledItems: [],
        explanations: new Map(),
        atRiskAssignments: [],
        changeSummary: { moved: [], added: [], removed: [] },
      }),
      getSchedulePlan: vi.fn().mockResolvedValue({
        id: 'sp1', userId: 'test-user-1', planDate: '2025-01-20', version: 1, blocks: [],
      }),
      getWeekPlan: vi.fn().mockResolvedValue([
        { id: 'sp1', userId: 'test-user-1', planDate: '2025-01-20', version: 1, blocks: [] },
      ]),
      lockBlock: vi.fn(),
      unlockBlock: vi.fn(),
      getExplanation: vi.fn(),
    } as unknown as ScheduleService;
    app = createTestApp((a) => a.use('/api/schedules', scheduleRouter(mockScheduleService)));
  });

  it('POST /api/schedules/generate creates a schedule', async () => {
    const res = await request(app, 'POST', '/api/schedules/generate', { date: '2025-01-20' });
    expect(res.status).toBe(201);
    expect(mockScheduleService.generateSchedule).toHaveBeenCalledWith('test-user-1', '2025-01-20');
  });

  it('POST /api/schedules/generate returns 400 for missing date', async () => {
    const res = await request(app, 'POST', '/api/schedules/generate', {});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.field).toBe('date');
  });

  it('POST /api/schedules/generate returns 404 when service throws NOT_FOUND', async () => {
    (mockScheduleService.generateSchedule as any).mockRejectedValue({
      error: { code: 'NOT_FOUND', message: 'Preference profile not found', details: { field: 'userId' } },
    });
    const res = await request(app, 'POST', '/api/schedules/generate', { date: '2025-01-20' });
    expect(res.status).toBe(404);
  });

  it('GET /api/schedules?date= returns schedule plan', async () => {
    const res = await request(app, 'GET', '/api/schedules?date=2025-01-20');
    expect(res.status).toBe(200);
    expect(res.body.planDate).toBe('2025-01-20');
    expect(mockScheduleService.getSchedulePlan).toHaveBeenCalledWith('test-user-1', '2025-01-20');
  });

  it('GET /api/schedules without date returns 400', async () => {
    const res = await request(app, 'GET', '/api/schedules');
    expect(res.status).toBe(400);
    expect(res.body.error.details.field).toBe('date');
  });

  it('GET /api/schedules/week?start= returns week plan', async () => {
    const res = await request(app, 'GET', '/api/schedules/week?start=2025-01-20');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(mockScheduleService.getWeekPlan).toHaveBeenCalledWith('test-user-1', '2025-01-20');
  });

  it('GET /api/schedules/week without start returns 400', async () => {
    const res = await request(app, 'GET', '/api/schedules/week');
    expect(res.status).toBe(400);
    expect(res.body.error.details.field).toBe('start');
  });

  it('POST /api/schedules/:id/repair repairs a schedule', async () => {
    const change = { type: 'add', sourceType: 'fixed_event', date: '2025-01-20' };
    const res = await request(app, 'POST', '/api/schedules/sp1/repair', { change });
    expect(res.status).toBe(200);
    expect(mockScheduleService.repairSchedule).toHaveBeenCalledWith('test-user-1', 'sp1', change);
  });

  it('POST /api/schedules/:id/repair returns 400 for missing change', async () => {
    const res = await request(app, 'POST', '/api/schedules/sp1/repair', {});
    expect(res.status).toBe(400);
    expect(res.body.error.details.field).toBe('change');
  });

  it('POST /api/schedules/:id/repair returns 404 for missing plan', async () => {
    (mockScheduleService.repairSchedule as any).mockRejectedValue({
      error: { code: 'NOT_FOUND', message: 'Schedule plan not found', details: { field: 'planId' } },
    });
    const res = await request(app, 'POST', '/api/schedules/missing/repair', {
      change: { type: 'add', sourceType: 'fixed_event', date: '2025-01-20' },
    });
    expect(res.status).toBe(404);
  });
});

// ─── Schedule Block Routes ────────────────────────────────────

describe('Schedule block routes', () => {
  let mockScheduleService: ScheduleService;
  let app: Express;

  beforeEach(() => {
    mockScheduleService = {
      lockBlock: vi.fn().mockResolvedValue({ id: 'b1', locked: true, title: 'Class' }),
      unlockBlock: vi.fn().mockResolvedValue({ id: 'b1', locked: false, title: 'Class' }),
      getExplanation: vi.fn().mockResolvedValue({
        id: 'ex1', blockId: 'b1', explanationText: 'Placed due to fixed event constraint', referencedConstraints: ['Fixed_Event'],
      }),
      generateSchedule: vi.fn(),
      repairSchedule: vi.fn(),
      getSchedulePlan: vi.fn(),
      getWeekPlan: vi.fn(),
    } as unknown as ScheduleService;
    app = createTestApp((a) => a.use('/api/schedule-blocks', scheduleBlockRouter(mockScheduleService)));
  });

  it('PUT /api/schedule-blocks/:id/lock locks a block', async () => {
    const res = await request(app, 'PUT', '/api/schedule-blocks/b1/lock');
    expect(res.status).toBe(200);
    expect(res.body.locked).toBe(true);
    expect(mockScheduleService.lockBlock).toHaveBeenCalledWith('b1');
  });

  it('PUT /api/schedule-blocks/:id/unlock unlocks a block', async () => {
    const res = await request(app, 'PUT', '/api/schedule-blocks/b1/unlock');
    expect(res.status).toBe(200);
    expect(res.body.locked).toBe(false);
    expect(mockScheduleService.unlockBlock).toHaveBeenCalledWith('b1');
  });

  it('PUT /api/schedule-blocks/:id/lock returns 404 for missing block', async () => {
    (mockScheduleService.lockBlock as any).mockRejectedValue({
      error: { code: 'NOT_FOUND', message: 'Block not found', details: { field: 'blockId' } },
    });
    const res = await request(app, 'PUT', '/api/schedule-blocks/missing/lock');
    expect(res.status).toBe(404);
  });

  it('PUT /api/schedule-blocks/:id/unlock returns 404 for missing block', async () => {
    (mockScheduleService.unlockBlock as any).mockRejectedValue({
      error: { code: 'NOT_FOUND', message: 'Block not found', details: { field: 'blockId' } },
    });
    const res = await request(app, 'PUT', '/api/schedule-blocks/missing/unlock');
    expect(res.status).toBe(404);
  });

  it('GET /api/schedule-blocks/:id/explanation returns explanation', async () => {
    const res = await request(app, 'GET', '/api/schedule-blocks/b1/explanation');
    expect(res.status).toBe(200);
    expect(res.body.explanationText).toBe('Placed due to fixed event constraint');
    expect(mockScheduleService.getExplanation).toHaveBeenCalledWith('b1');
  });

  it('GET /api/schedule-blocks/:id/explanation returns 404 for missing explanation', async () => {
    (mockScheduleService.getExplanation as any).mockRejectedValue({
      error: { code: 'NOT_FOUND', message: 'Explanation not found', details: { field: 'blockId' } },
    });
    const res = await request(app, 'GET', '/api/schedule-blocks/missing/explanation');
    expect(res.status).toBe(404);
  });
});
