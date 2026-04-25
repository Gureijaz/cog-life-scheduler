import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { EventService } from './event';
import type { FixedEvent } from '../types/domain';
import type {
  FixedEventRepository,
  SchedulePlanRepository,
  ScheduleBlockRepository,
} from '../repositories/entities';

// ── Helpers ───────────────────────────────────────────────

/** Convert HH:mm to total minutes since midnight */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Convert total minutes to HH:mm */
function minutesToTime(mins: number): string {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Arbitrary that generates a valid time range (start < end) as {startTime, endTime} in HH:mm.
 * Minutes range from 0 (00:00) to 1439 (23:59). We need start < end so end >= start + 1.
 */
const timeRangeArb = fc
  .integer({ min: 0, max: 1438 })
  .chain((startMin) =>
    fc.integer({ min: startMin + 1, max: 1439 }).map((endMin) => ({
      startTime: minutesToTime(startMin),
      endTime: minutesToTime(endMin),
    })),
  );

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

function mockPlanRepo(): SchedulePlanRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    findByUserAndDate: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as SchedulePlanRepository;
}

function mockBlockRepo(): ScheduleBlockRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    findByPlan: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as ScheduleBlockRepository;
}

function makeFixedEvent(id: string, startTime: string, endTime: string): FixedEvent {
  return {
    id,
    userId: 'u-1',
    title: `Event ${id}`,
    eventDate: '2025-06-15',
    startTime,
    endTime,
    locationId: null,
    recurrenceRule: null,
    recurrenceParentId: null,
    category: 'test',
    notes: null,
    createdAt: new Date(),
  };
}

// ── Property Tests ────────────────────────────────────────

describe('Property 3: Fixed Event Overlap Detection', () => {
  /**
   * **Validates: Requirements 2.3**
   *
   * For any two Fixed_Events on the same date, the overlap detection function
   * SHALL return a conflict if and only if their time ranges overlap
   * (i.e., one starts before the other ends and vice versa: startA < endB && startB < endA).
   */
  it('should detect conflict iff time ranges overlap', async () => {
    await fc.assert(
      fc.asyncProperty(timeRangeArb, timeRangeArb, async (rangeA, rangeB) => {
        const existingEvent = makeFixedEvent('ev-existing', rangeA.startTime, rangeA.endTime);

        const eventRepo = mockEventRepo({
          findByUserAndDate: vi.fn().mockResolvedValue([existingEvent]),
          findMany: vi.fn().mockResolvedValue([]),
        });
        const service = new EventService(eventRepo, mockPlanRepo(), mockBlockRepo());

        const warnings = await service.checkConflicts('u-1', {
          id: 'ev-new',
          eventDate: '2025-06-15',
          startTime: rangeB.startTime,
          endTime: rangeB.endTime,
        });

        const startA = timeToMinutes(rangeA.startTime);
        const endA = timeToMinutes(rangeA.endTime);
        const startB = timeToMinutes(rangeB.startTime);
        const endB = timeToMinutes(rangeB.endTime);

        const shouldOverlap = startA < endB && startB < endA;

        if (shouldOverlap) {
          expect(warnings.length).toBe(1);
          expect(warnings[0].existingEventId).toBe('ev-existing');
        } else {
          expect(warnings.length).toBe(0);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('should never report conflict between an event and itself', async () => {
    await fc.assert(
      fc.asyncProperty(timeRangeArb, async (range) => {
        const existingEvent = makeFixedEvent('ev-same', range.startTime, range.endTime);

        const eventRepo = mockEventRepo({
          findByUserAndDate: vi.fn().mockResolvedValue([existingEvent]),
          findMany: vi.fn().mockResolvedValue([]),
        });
        const service = new EventService(eventRepo, mockPlanRepo(), mockBlockRepo());

        const warnings = await service.checkConflicts('u-1', {
          id: 'ev-same', // same id as existing
          eventDate: '2025-06-15',
          startTime: range.startTime,
          endTime: range.endTime,
        });

        expect(warnings.length).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  it('should detect correct number of conflicts with multiple existing events', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(timeRangeArb, { minLength: 1, maxLength: 5 }),
        timeRangeArb,
        async (existingRanges, newRange) => {
          const existingEvents = existingRanges.map((r, i) =>
            makeFixedEvent(`ev-${i}`, r.startTime, r.endTime),
          );

          const eventRepo = mockEventRepo({
            findByUserAndDate: vi.fn().mockResolvedValue(existingEvents),
            findMany: vi.fn().mockResolvedValue([]),
          });
          const service = new EventService(eventRepo, mockPlanRepo(), mockBlockRepo());

          const warnings = await service.checkConflicts('u-1', {
            id: 'ev-new',
            eventDate: '2025-06-15',
            startTime: newRange.startTime,
            endTime: newRange.endTime,
          });

          const newStart = timeToMinutes(newRange.startTime);
          const newEnd = timeToMinutes(newRange.endTime);

          const expectedConflicts = existingEvents.filter((ev) => {
            const s = timeToMinutes(ev.startTime);
            const e = timeToMinutes(ev.endTime);
            return newStart < e && s < newEnd;
          });

          expect(warnings.length).toBe(expectedConflicts.length);

          // Verify each warning references a truly overlapping event
          for (const w of warnings) {
            const matched = existingEvents.find((ev) => ev.id === w.existingEventId);
            expect(matched).toBeDefined();
            const s = timeToMinutes(matched!.startTime);
            const e = timeToMinutes(matched!.endTime);
            expect(newStart < e && s < newEnd).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
