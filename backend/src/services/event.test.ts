import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventService } from './event';
import type { FixedEvent, SchedulePlan, ScheduleBlock } from '../types/domain';
import type {
  FixedEventRepository,
  SchedulePlanRepository,
  ScheduleBlockRepository,
} from '../repositories/entities';

// ── Mock factories ────────────────────────────────────────

function mockEventRepo(overrides: Partial<FixedEventRepository> = {}): FixedEventRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    findByUserAndDate: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (data) => ({ id: 'ev-1', ...data })),
    update: vi.fn().mockImplementation(async (id, data) => ({ id, ...data })),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as FixedEventRepository;
}

function mockPlanRepo(overrides: Partial<SchedulePlanRepository> = {}): SchedulePlanRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    findByUserAndDate: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (data) => ({ id: 'pl-1', ...data })),
    update: vi.fn().mockImplementation(async (id, data) => ({ id, ...data })),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as SchedulePlanRepository;
}

function mockBlockRepo(overrides: Partial<ScheduleBlockRepository> = {}): ScheduleBlockRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    findByPlan: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (data) => ({ id: 'bl-1', ...data })),
    update: vi.fn().mockImplementation(async (id, data) => ({ id, ...data })),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ScheduleBlockRepository;
}

// ── Sample data ───────────────────────────────────────────

const sampleEvent: FixedEvent = {
  id: 'ev-1',
  userId: 'u-1',
  title: 'Math Class',
  eventDate: '2025-03-10',
  startTime: '09:00',
  endTime: '10:30',
  locationId: null,
  recurrenceRule: null,
  recurrenceParentId: null,
  category: 'class',
  notes: null,
  createdAt: new Date(),
};

const sampleRecurringEvent: FixedEvent = {
  ...sampleEvent,
  id: 'ev-rec',
  title: 'Weekly Standup',
  recurrenceRule: 'WEEKLY:MON,WED,FRI',
};

describe('EventService', () => {
  let eventRepo: ReturnType<typeof mockEventRepo>;
  let planRepo: ReturnType<typeof mockPlanRepo>;
  let blockRepo: ReturnType<typeof mockBlockRepo>;
  let service: EventService;

  beforeEach(() => {
    eventRepo = mockEventRepo();
    planRepo = mockPlanRepo();
    blockRepo = mockBlockRepo();
    service = new EventService(eventRepo, planRepo, blockRepo);
  });

  // ── createFixedEvent ──────────────────────────────────

  describe('createFixedEvent', () => {
    it('stores all required fields', async () => {
      const result = await service.createFixedEvent('u-1', {
        title: 'Math Class',
        eventDate: '2025-03-10',
        startTime: '09:00',
        endTime: '10:30',
        category: 'class',
      });

      expect(eventRepo.create).toHaveBeenCalledOnce();
      const arg = (eventRepo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(arg.userId).toBe('u-1');
      expect(arg.title).toBe('Math Class');
      expect(arg.eventDate).toBe('2025-03-10');
      expect(arg.startTime).toBe('09:00');
      expect(arg.endTime).toBe('10:30');
      expect(arg.category).toBe('class');
      expect(arg.locationId).toBeNull();
      expect(arg.recurrenceRule).toBeNull();
      expect(arg.recurrenceParentId).toBeNull();
      expect(arg.notes).toBeNull();
      expect(result.id).toBe('ev-1');
    });

    it('stores optional fields when provided', async () => {
      await service.createFixedEvent('u-1', {
        title: 'Gym',
        eventDate: '2025-03-10',
        startTime: '17:00',
        endTime: '18:00',
        category: 'fitness',
        locationId: 'loc-1',
        recurrenceRule: 'WEEKLY:MON,WED',
        notes: 'Bring towel',
      });

      const arg = (eventRepo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(arg.locationId).toBe('loc-1');
      expect(arg.recurrenceRule).toBe('WEEKLY:MON,WED');
      expect(arg.notes).toBe('Bring towel');
    });

    it('rejects empty title', async () => {
      await expect(
        service.createFixedEvent('u-1', {
          title: '',
          eventDate: '2025-03-10',
          startTime: '09:00',
          endTime: '10:00',
          category: 'class',
        }),
      ).rejects.toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    });

    it('rejects end time before start time', async () => {
      await expect(
        service.createFixedEvent('u-1', {
          title: 'Bad Event',
          eventDate: '2025-03-10',
          startTime: '10:00',
          endTime: '09:00',
          category: 'class',
        }),
      ).rejects.toMatchObject({ error: { code: 'INVALID_TIME_RANGE' } });
    });

    it('rejects equal start and end time', async () => {
      await expect(
        service.createFixedEvent('u-1', {
          title: 'Zero Duration',
          eventDate: '2025-03-10',
          startTime: '10:00',
          endTime: '10:00',
          category: 'class',
        }),
      ).rejects.toMatchObject({ error: { code: 'INVALID_TIME_RANGE' } });
    });
  });

  // ── updateFixedEvent ──────────────────────────────────

  describe('updateFixedEvent', () => {
    beforeEach(() => {
      (eventRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(sampleEvent);
    });

    it('updates fields on an existing event', async () => {
      await service.updateFixedEvent('ev-1', { title: 'Updated Title' });
      expect(eventRepo.update).toHaveBeenCalledOnce();
    });

    it('throws NOT_FOUND for missing event', async () => {
      (eventRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      await expect(
        service.updateFixedEvent('missing', { title: 'X' }),
      ).rejects.toMatchObject({ error: { code: 'NOT_FOUND' } });
    });

    it('rejects invalid time range on update', async () => {
      await expect(
        service.updateFixedEvent('ev-1', { startTime: '12:00', endTime: '11:00' }),
      ).rejects.toMatchObject({ error: { code: 'INVALID_TIME_RANGE' } });
    });

    it('validates merged times when only one time field changes', async () => {
      // existing is 09:00-10:30, changing end to 08:00 should fail
      await expect(
        service.updateFixedEvent('ev-1', { endTime: '08:00' }),
      ).rejects.toMatchObject({ error: { code: 'INVALID_TIME_RANGE' } });
    });
  });

  // ── updateRecurrenceInstance ───────────────────────────

  describe('updateRecurrenceInstance', () => {
    beforeEach(() => {
      (eventRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(sampleRecurringEvent);
      (eventRepo.findByUserAndDate as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    });

    it('creates a new override instance when none exists', async () => {
      await service.updateRecurrenceInstance('ev-rec', '2025-03-10', {
        title: 'Special Standup',
      });

      expect(eventRepo.create).toHaveBeenCalledOnce();
      const arg = (eventRepo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(arg.title).toBe('Special Standup');
      expect(arg.eventDate).toBe('2025-03-10');
      expect(arg.recurrenceParentId).toBe('ev-rec');
      expect(arg.recurrenceRule).toBeNull();
    });

    it('updates an existing override instance', async () => {
      const existingOverride: FixedEvent = {
        ...sampleEvent,
        id: 'ev-override',
        recurrenceParentId: 'ev-rec',
        eventDate: '2025-03-10',
      };
      (eventRepo.findByUserAndDate as ReturnType<typeof vi.fn>).mockResolvedValue([existingOverride]);

      await service.updateRecurrenceInstance('ev-rec', '2025-03-10', {
        title: 'Updated Override',
      });

      expect(eventRepo.update).toHaveBeenCalledWith('ev-override', expect.anything());
    });

    it('throws NOT_FOUND for missing parent event', async () => {
      (eventRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      await expect(
        service.updateRecurrenceInstance('missing', '2025-03-10', { title: 'X' }),
      ).rejects.toMatchObject({ error: { code: 'NOT_FOUND' } });
    });

    it('rejects invalid time range on new instance', async () => {
      await expect(
        service.updateRecurrenceInstance('ev-rec', '2025-03-10', {
          startTime: '14:00',
          endTime: '13:00',
        }),
      ).rejects.toMatchObject({ error: { code: 'INVALID_TIME_RANGE' } });
    });
  });

  // ── deleteFixedEvent ──────────────────────────────────

  describe('deleteFixedEvent', () => {
    it('deletes the event and removes associated schedule blocks from future plans', async () => {
      (eventRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(sampleEvent);

      const futurePlan: SchedulePlan = {
        id: 'pl-1',
        userId: 'u-1',
        planDate: '2099-01-01',
        version: 1,
        generatedAt: new Date(),
        blocks: [],
      };
      (planRepo.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([futurePlan]);

      const matchingBlock: ScheduleBlock = {
        id: 'bl-1',
        planId: 'pl-1',
        sourceType: 'fixed_event',
        sourceId: 'ev-1',
        title: 'Math Class',
        startTime: '09:00',
        endTime: '10:30',
        locationId: null,
        locked: false,
        sortOrder: 0,
      };
      const unrelatedBlock: ScheduleBlock = {
        ...matchingBlock,
        id: 'bl-2',
        sourceId: 'ev-other',
      };
      (blockRepo.findByPlan as ReturnType<typeof vi.fn>).mockResolvedValue([matchingBlock, unrelatedBlock]);

      await service.deleteFixedEvent('ev-1');

      // Should delete only the matching block
      expect(blockRepo.delete).toHaveBeenCalledWith('bl-1');
      expect(blockRepo.delete).not.toHaveBeenCalledWith('bl-2');
      // Should delete the event itself
      expect(eventRepo.delete).toHaveBeenCalledWith('ev-1');
    });

    it('does not delete blocks from past plans', async () => {
      (eventRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(sampleEvent);

      const pastPlan: SchedulePlan = {
        id: 'pl-past',
        userId: 'u-1',
        planDate: '2020-01-01',
        version: 1,
        generatedAt: new Date(),
        blocks: [],
      };
      (planRepo.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([pastPlan]);

      await service.deleteFixedEvent('ev-1');

      expect(blockRepo.findByPlan).not.toHaveBeenCalled();
      expect(eventRepo.delete).toHaveBeenCalledWith('ev-1');
    });

    it('throws NOT_FOUND for missing event', async () => {
      await expect(service.deleteFixedEvent('missing')).rejects.toMatchObject({
        error: { code: 'NOT_FOUND' },
      });
    });
  });

  // ── getFixedEventsForDate ─────────────────────────────

  describe('getFixedEventsForDate', () => {
    it('returns direct events for the date', async () => {
      (eventRepo.findByUserAndDate as ReturnType<typeof vi.fn>).mockResolvedValue([sampleEvent]);
      (eventRepo.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([sampleEvent]);

      const result = await service.getFixedEventsForDate('u-1', '2025-03-10');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ev-1');
    });

    it('expands recurring events for the date', async () => {
      // No direct events on this date
      (eventRepo.findByUserAndDate as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      // The recurring parent exists in the user's events
      (eventRepo.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([sampleRecurringEvent]);

      // 2025-03-10 is a Monday, which matches WEEKLY:MON,WED,FRI
      const result = await service.getFixedEventsForDate('u-1', '2025-03-10');
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].recurrenceParentId).toBe('ev-rec');
      expect(result[0].eventDate).toBe('2025-03-10');
    });

    it('prefers override instances over expanded recurrence', async () => {
      const override: FixedEvent = {
        ...sampleEvent,
        id: 'ev-override',
        title: 'Override Standup',
        recurrenceParentId: 'ev-rec',
        eventDate: '2025-03-10',
      };
      (eventRepo.findByUserAndDate as ReturnType<typeof vi.fn>).mockResolvedValue([override]);
      (eventRepo.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([sampleRecurringEvent]);

      const result = await service.getFixedEventsForDate('u-1', '2025-03-10');
      // Should have the override but not a duplicate expanded instance
      const titles = result.map((e) => e.title);
      expect(titles).toContain('Override Standup');
      // No duplicate from expansion
      const parentRefs = result.filter((e) => e.recurrenceParentId === 'ev-rec');
      expect(parentRefs).toHaveLength(1);
    });
  });

  // ── checkConflicts ────────────────────────────────────

  describe('checkConflicts', () => {
    it('returns conflict warnings for overlapping events', async () => {
      const existingEvent: FixedEvent = {
        ...sampleEvent,
        id: 'ev-existing',
        startTime: '09:00',
        endTime: '10:00',
      };
      (eventRepo.findByUserAndDate as ReturnType<typeof vi.fn>).mockResolvedValue([existingEvent]);
      (eventRepo.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const warnings = await service.checkConflicts('u-1', {
        id: 'ev-new',
        eventDate: '2025-03-10',
        startTime: '09:30',
        endTime: '10:30',
      });

      expect(warnings).toHaveLength(1);
      expect(warnings[0].existingEventId).toBe('ev-existing');
      expect(warnings[0].existingEventTitle).toBe('Math Class');
      expect(warnings[0].overlapStart).toBe('09:30');
      expect(warnings[0].overlapEnd).toBe('10:00');
    });

    it('returns empty array when no overlaps', async () => {
      const existingEvent: FixedEvent = {
        ...sampleEvent,
        id: 'ev-existing',
        startTime: '09:00',
        endTime: '10:00',
      };
      (eventRepo.findByUserAndDate as ReturnType<typeof vi.fn>).mockResolvedValue([existingEvent]);
      (eventRepo.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const warnings = await service.checkConflicts('u-1', {
        id: 'ev-new',
        eventDate: '2025-03-10',
        startTime: '10:00',
        endTime: '11:00',
      });

      expect(warnings).toHaveLength(0);
    });

    it('skips self when checking conflicts', async () => {
      (eventRepo.findByUserAndDate as ReturnType<typeof vi.fn>).mockResolvedValue([sampleEvent]);
      (eventRepo.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const warnings = await service.checkConflicts('u-1', {
        id: 'ev-1', // same as sampleEvent
        eventDate: '2025-03-10',
        startTime: '09:00',
        endTime: '10:30',
      });

      expect(warnings).toHaveLength(0);
    });

    it('detects multiple conflicts', async () => {
      const event1: FixedEvent = { ...sampleEvent, id: 'ev-a', startTime: '08:00', endTime: '09:30' };
      const event2: FixedEvent = { ...sampleEvent, id: 'ev-b', startTime: '10:00', endTime: '11:00' };
      (eventRepo.findByUserAndDate as ReturnType<typeof vi.fn>).mockResolvedValue([event1, event2]);
      (eventRepo.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const warnings = await service.checkConflicts('u-1', {
        id: 'ev-new',
        eventDate: '2025-03-10',
        startTime: '09:00',
        endTime: '10:30',
      });

      expect(warnings).toHaveLength(2);
    });
  });
});
