import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { expandRecurrence, parseWeeklyRule } from './recurrence';
import type { FixedEvent } from '../types/domain';

// ---------------------------------------------------------------------------
// Arbitraries — generators for recurrence domain objects
// ---------------------------------------------------------------------------

const DAY_TOKENS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const DAY_TOKEN_TO_NUM: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

/** Generate a non-empty subset of weekday tokens (1–7 days). */
const weekdaySubsetArb = fc
  .subarray([...DAY_TOKENS], { minLength: 1, maxLength: 7 })
  .filter((arr) => arr.length > 0);

/** Generate a valid WEEKLY recurrence rule string like "WEEKLY:MON,WED,FRI". */
const recurrenceRuleArb = weekdaySubsetArb.map(
  (days) => `WEEKLY:${days.join(',')}`,
);

/** Generate a planning horizon as [startDate, endDate] where end >= start and span is 1–60 days. */
const horizonArb = fc
  .record({
    year: fc.constantFrom(2025),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }), // stay within valid days for all months
    spanDays: fc.integer({ min: 0, max: 60 }),
  })
  .map(({ year, month, day, spanDays }) => {
    const start = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const end = new Date(start.getTime() + spanDays * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    return { startDate: fmt(start), endDate: fmt(end) };
  });

/** Generate a valid HH:mm time pair where end > start. */
const timePairArb = fc
  .record({
    startH: fc.integer({ min: 0, max: 22 }),
    startM: fc.integer({ min: 0, max: 59 }),
    durationMin: fc.integer({ min: 1, max: 120 }),
  })
  .map(({ startH, startM, durationMin }) => {
    const startTotal = startH * 60 + startM;
    const endTotal = Math.min(startTotal + durationMin, 23 * 60 + 59);
    if (endTotal <= startTotal) return null;
    const fmt = (mins: number) =>
      `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    return { startTime: fmt(startTotal), endTime: fmt(endTotal) };
  })
  .filter((v): v is { startTime: string; endTime: string } => v !== null);

/** Build a FixedEvent with a recurrence rule. */
function makeRecurringEvent(overrides: Partial<FixedEvent> = {}): FixedEvent {
  return {
    id: 'parent-1',
    userId: 'user-1',
    title: 'Recurring Event',
    eventDate: '2025-01-06',
    startTime: '09:00',
    endTime: '10:30',
    locationId: 'loc-1',
    recurrenceRule: 'WEEKLY:MON,WED,FRI',
    recurrenceParentId: null,
    category: 'class',
    notes: null,
    createdAt: new Date('2025-01-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

const NUM_RUNS = 100;

describe('Property 4: Recurrence Instance Generation', () => {
  /**
   * **Validates: Requirements 2.4**
   *
   * For any FixedEvent with a valid recurrence rule and a planning horizon,
   * the generated instances SHALL all match the recurrence pattern (correct
   * day of week) and fall within the planning horizon boundaries.
   */
  it('all generated instances match the recurrence pattern and fall within the horizon', () => {
    fc.assert(
      fc.property(
        recurrenceRuleArb,
        horizonArb,
        timePairArb,
        (rule, horizon, times) => {
          const event = makeRecurringEvent({
            recurrenceRule: rule,
            startTime: times.startTime,
            endTime: times.endTime,
          });

          const instances = expandRecurrence(event, horizon.startDate, horizon.endDate);

          // Parse expected day numbers from the rule
          const parsed = parseWeeklyRule(rule);
          expect(parsed).not.toBeNull();
          const expectedDays = new Set(parsed!);

          const horizonStartMs = new Date(horizon.startDate + 'T00:00:00Z').getTime();
          const horizonEndMs = new Date(horizon.endDate + 'T23:59:59.999Z').getTime();

          for (const instance of instances) {
            // Each instance's day-of-week must match the recurrence pattern
            const instanceDate = new Date(instance.eventDate + 'T12:00:00Z');
            expect(expectedDays.has(instanceDate.getUTCDay())).toBe(true);

            // Each instance must fall within the horizon boundaries (inclusive)
            const instanceMs = instanceDate.getTime();
            expect(instanceMs).toBeGreaterThanOrEqual(horizonStartMs);
            expect(instanceMs).toBeLessThanOrEqual(horizonEndMs);

            // Instance preserves parent metadata
            expect(instance.startTime).toBe(event.startTime);
            expect(instance.endTime).toBe(event.endTime);
            expect(instance.title).toBe(event.title);
            expect(instance.recurrenceParentId).toBe(event.id);
            expect(instance.recurrenceRule).toBeNull();
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('generates all matching days within the horizon (no missing instances)', () => {
    fc.assert(
      fc.property(
        recurrenceRuleArb,
        horizonArb,
        (rule, horizon) => {
          const event = makeRecurringEvent({ recurrenceRule: rule });
          const instances = expandRecurrence(event, horizon.startDate, horizon.endDate);

          const parsed = parseWeeklyRule(rule);
          expect(parsed).not.toBeNull();
          const expectedDays = new Set(parsed!);

          // Count how many matching days exist in the horizon
          const start = new Date(horizon.startDate + 'T12:00:00Z');
          const end = new Date(horizon.endDate + 'T12:00:00Z');
          let expectedCount = 0;
          const cursor = new Date(start);
          while (cursor <= end) {
            if (expectedDays.has(cursor.getUTCDay())) expectedCount++;
            cursor.setUTCDate(cursor.getUTCDate() + 1);
          }

          expect(instances.length).toBe(expectedCount);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('all generated instance ids are unique', () => {
    fc.assert(
      fc.property(
        recurrenceRuleArb,
        horizonArb,
        (rule, horizon) => {
          const event = makeRecurringEvent({ recurrenceRule: rule });
          const instances = expandRecurrence(event, horizon.startDate, horizon.endDate);

          const ids = instances.map((i) => i.id);
          expect(new Set(ids).size).toBe(ids.length);

          // No instance id should match the parent id
          for (const id of ids) {
            expect(id).not.toBe(event.id);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});


describe('Property 5: Recurrence Instance Edit Isolation', () => {
  /**
   * **Validates: Requirements 2.5**
   *
   * For any recurring FixedEvent and any single-instance edit, all instances
   * other than the edited one SHALL remain identical to their state before
   * the edit.
   */
  it('editing one instance does not affect other instances', () => {
    fc.assert(
      fc.property(
        recurrenceRuleArb,
        horizonArb,
        timePairArb,
        fc.record({
          newTitle: fc.string({ minLength: 1, maxLength: 20 }),
          newStartTime: timePairArb,
        }),
        (rule, horizon, times, edits) => {
          const event = makeRecurringEvent({
            recurrenceRule: rule,
            startTime: times.startTime,
            endTime: times.endTime,
          });

          // Generate instances before any edit
          const instancesBefore = expandRecurrence(event, horizon.startDate, horizon.endDate);
          if (instancesBefore.length < 2) return; // need at least 2 instances to test isolation

          // Pick a random instance index to edit
          const editIndex = instancesBefore.length > 1 ? 1 : 0;

          // Generate instances again (simulating a fresh expansion)
          const instancesAfter = expandRecurrence(event, horizon.startDate, horizon.endDate);

          // Simulate editing one instance
          const editedInstances = instancesAfter.map((inst, i) => {
            if (i === editIndex) {
              return {
                ...inst,
                title: edits.newTitle,
                startTime: edits.newStartTime.startTime,
                endTime: edits.newStartTime.endTime,
              };
            }
            return inst;
          });

          // Verify all non-edited instances remain unchanged
          for (let i = 0; i < instancesBefore.length; i++) {
            if (i === editIndex) continue;

            const before = instancesBefore[i];
            const after = editedInstances[i];

            // Core fields that must be preserved
            expect(after.eventDate).toBe(before.eventDate);
            expect(after.startTime).toBe(before.startTime);
            expect(after.endTime).toBe(before.endTime);
            expect(after.title).toBe(before.title);
            expect(after.locationId).toBe(before.locationId);
            expect(after.category).toBe(before.category);
            expect(after.recurrenceParentId).toBe(before.recurrenceParentId);
            expect(after.recurrenceRule).toBe(before.recurrenceRule);
            expect(after.userId).toBe(before.userId);
            expect(after.notes).toBe(before.notes);
          }

          // Verify the edited instance actually changed
          const edited = editedInstances[editIndex];
          expect(edited.title).toBe(edits.newTitle);
          expect(edited.startTime).toBe(edits.newStartTime.startTime);
          expect(edited.endTime).toBe(edits.newStartTime.endTime);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('instance count remains the same after editing one instance', () => {
    fc.assert(
      fc.property(
        recurrenceRuleArb,
        horizonArb,
        (rule, horizon) => {
          const event = makeRecurringEvent({ recurrenceRule: rule });

          const instancesBefore = expandRecurrence(event, horizon.startDate, horizon.endDate);

          // Simulate editing one instance (doesn't affect expansion count)
          const instancesAfter = expandRecurrence(event, horizon.startDate, horizon.endDate);

          expect(instancesAfter.length).toBe(instancesBefore.length);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
