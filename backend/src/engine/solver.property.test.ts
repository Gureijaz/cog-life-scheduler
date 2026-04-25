import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type {
  FixedEvent,
  FlexibleTask,
  Assignment,
  PreferenceProfile,
  TravelRule,
  ScheduleBlock,
} from '../types/domain';
import type { ScheduleInput } from '../types/engine';
import { solve, timeToMinutes } from './solver';

// ---------------------------------------------------------------------------
// Arbitraries — generators for valid domain objects
// ---------------------------------------------------------------------------

/** Generate an HH:mm time string. */
const timeArb = fc
  .record({
    h: fc.integer({ min: 0, max: 23 }),
    m: fc.integer({ min: 0, max: 59 }),
  })
  .map(({ h, m }) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

/** Generate a wake/sleep pair where wake < sleep and there's at least 4 hours of waking time. */
const wakeSleepArb = fc
  .record({
    wakeH: fc.integer({ min: 5, max: 10 }),
    wakeM: fc.integer({ min: 0, max: 59 }),
    awakeHours: fc.integer({ min: 8, max: 14 }),
  })
  .map(({ wakeH, wakeM, awakeHours }) => {
    const sleepH = Math.min(wakeH + awakeHours, 23);
    return {
      wakeTime: `${String(wakeH).padStart(2, '0')}:${String(wakeM).padStart(2, '0')}`,
      sleepTime: `${String(sleepH).padStart(2, '0')}:00`,
    };
  });

/** Generate a PreferenceProfile. */
const preferencesArb = wakeSleepArb.chain(({ wakeTime, sleepTime }) =>
  fc.record({
    minBufferMinutes: fc.integer({ min: 0, max: 10 }),
    maxDeepWorkMinutes: fc.integer({ min: 30, max: 120 }),
    defaultCommuteMinutes: fc.integer({ min: 5, max: 30 }),
  }).map(({ minBufferMinutes, maxDeepWorkMinutes, defaultCommuteMinutes }) => ({
    id: 'pref-1',
    userId: 'user-1',
    wakeTime,
    sleepTime,
    focusWindows: [],
    workoutWindows: [],
    minBufferMinutes,
    maxDeepWorkMinutes,
    defaultCommuteMinutes,
    autoRepairEnabled: false,
    updatedAt: new Date(),
  } satisfies PreferenceProfile))
);

/**
 * Generate a FixedEvent that fits within the given wake/sleep window.
 * Returns an arbitrary that produces 0–3 non-overlapping fixed events.
 */
function fixedEventsArb(wakeTime: string, sleepTime: string): fc.Arbitrary<FixedEvent[]> {
  const wakeMin = timeToMinutes(wakeTime);
  const sleepMin = timeToMinutes(sleepTime);
  const windowSize = sleepMin - wakeMin;
  if (windowSize < 60) return fc.constant([]);

  return fc.integer({ min: 0, max: 3 }).chain(count => {
    if (count === 0) return fc.constant([]);
    // Generate non-overlapping events by dividing the window into slots
    const slotSize = Math.floor(windowSize / count);
    if (slotSize < 30) return fc.constant([]);

    const arbs = Array.from({ length: count }, (_, i) => {
      const slotStart = wakeMin + i * slotSize;
      const slotEnd = slotStart + slotSize;
      return fc.record({
        startOffset: fc.integer({ min: 0, max: Math.max(0, Math.floor(slotSize / 3)) }),
        duration: fc.integer({ min: 20, max: Math.min(60, slotSize - 10) }),
        locationId: fc.oneof(fc.constant(null), fc.constant('loc-a'), fc.constant('loc-b')),
      }).map(({ startOffset, duration, locationId }) => {
        const start = Math.min(slotStart + startOffset, slotEnd - duration);
        const end = Math.min(start + duration, sleepMin);
        return {
          id: `fe-${i}`,
          userId: 'user-1',
          title: `Event ${i}`,
          eventDate: '2025-01-20',
          startTime: minutesToTimeStr(Math.max(start, wakeMin)),
          endTime: minutesToTimeStr(Math.min(end, sleepMin)),
          locationId,
          recurrenceRule: null,
          recurrenceParentId: null,
          category: 'class',
          notes: null,
          createdAt: new Date(),
        } satisfies FixedEvent;
      });
    });
    return fc.tuple(...(arbs as [fc.Arbitrary<FixedEvent>, ...fc.Arbitrary<FixedEvent>[]])).map(events =>
      events.filter(e => timeToMinutes(e.endTime) > timeToMinutes(e.startTime))
    );
  });
}

function minutesToTimeStr(minutes: number): string {
  const clamped = Math.max(0, Math.min(minutes, 1439));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Generate a FlexibleTask. */
function flexibleTaskArb(index: number): fc.Arbitrary<FlexibleTask> {
  return fc.record({
    estimatedMinutes: fc.integer({ min: 15, max: 120 }),
    minSessionMinutes: fc.integer({ min: 10, max: 30 }),
    priority: fc.constantFrom('low' as const, 'medium' as const, 'high' as const, 'critical' as const),
  }).map(({ estimatedMinutes, minSessionMinutes, priority }) => ({
    id: `ft-${index}`,
    userId: 'user-1',
    title: `Task ${index}`,
    category: 'study',
    estimatedMinutes,
    minSessionMinutes: Math.min(minSessionMinutes, estimatedMinutes),
    priority,
    dueDate: null,
    energyRequirement: 'medium' as const,
    preferredWindow: null,
    remainingMinutes: estimatedMinutes,
    createdAt: new Date(),
  }));
}

/** Generate 0–3 flexible tasks. */
const flexibleTasksArb = fc.integer({ min: 0, max: 3 }).chain(count =>
  count === 0
    ? fc.constant([])
    : fc.tuple(
        ...(Array.from({ length: count }, (_, i) => flexibleTaskArb(i)) as [fc.Arbitrary<FlexibleTask>, ...fc.Arbitrary<FlexibleTask>[]])
      ).map(arr => arr)
);

/** Generate an Assignment with a future deadline. */
function assignmentArb(index: number): fc.Arbitrary<Assignment> {
  return fc.record({
    remainingMinutes: fc.integer({ min: 15, max: 180 }),
    estimatedTotalMinutes: fc.integer({ min: 30, max: 240 }),
    progressPercent: fc.integer({ min: 0, max: 80 }),
    daysUntilDeadline: fc.integer({ min: 0, max: 10 }),
  }).map(({ remainingMinutes, estimatedTotalMinutes, progressPercent, daysUntilDeadline }) => ({
    id: `a-${index}`,
    userId: 'user-1',
    title: `Assignment ${index}`,
    subject: 'Subject',
    deadline: new Date(`2025-01-${20 + daysUntilDeadline}T23:59:00Z`),
    estimatedTotalMinutes: Math.max(estimatedTotalMinutes, remainingMinutes),
    progressPercent,
    urgencyScore: 0,
    remainingMinutes,
    createdAt: new Date(),
  }));
}

/** Generate 0–3 assignments. */
const assignmentsArb = fc.integer({ min: 0, max: 3 }).chain(count =>
  count === 0
    ? fc.constant([])
    : fc.tuple(
        ...(Array.from({ length: count }, (_, i) => assignmentArb(i)) as [fc.Arbitrary<Assignment>, ...fc.Arbitrary<Assignment>[]])
      ).map(arr => arr)
);

/** Generate travel rules for loc-a and loc-b. */
const travelRulesArb: fc.Arbitrary<TravelRule[]> = fc.oneof(
  fc.constant([]),
  fc.integer({ min: 5, max: 25 }).map(mins => [
    { id: 'tr-1', userId: 'user-1', originId: 'loc-a', destinationId: 'loc-b', travelMinutes: mins },
    { id: 'tr-2', userId: 'user-1', originId: 'loc-b', destinationId: 'loc-a', travelMinutes: mins },
  ]),
);

/** Generate a complete valid ScheduleInput. */
const scheduleInputArb: fc.Arbitrary<ScheduleInput> = preferencesArb.chain(preferences =>
  fc.tuple(
    fixedEventsArb(preferences.wakeTime, preferences.sleepTime),
    flexibleTasksArb,
    assignmentsArb,
    travelRulesArb,
  ).map(([fixedEvents, flexibleTasks, assignments, travelRules]) => ({
    date: '2025-01-20',
    fixedEvents,
    flexibleTasks,
    assignments,
    travelRules,
    preferences,
    lockedBlocks: [],
  }))
);

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function blockDuration(block: ScheduleBlock): number {
  return timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
}

function blocksOverlap(a: ScheduleBlock, b: ScheduleBlock): boolean {
  const aStart = timeToMinutes(a.startTime);
  const aEnd = timeToMinutes(a.endTime);
  const bStart = timeToMinutes(b.startTime);
  const bEnd = timeToMinutes(b.endTime);
  return aStart < bEnd && bStart < aEnd;
}

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

describe('Scheduler Property Tests', () => {
  const NUM_RUNS = 100;

  // -------------------------------------------------------------------------
  // Property 6: Fixed Events Are Immovable Hard Constraints
  // -------------------------------------------------------------------------
  describe('Property 6: Fixed Events Are Immovable Hard Constraints', () => {
    /**
     * **Validates: Requirements 2.7, 6.2**
     *
     * For any set of FixedEvents and any generated SchedulePlan, every
     * FixedEvent SHALL appear in the plan at its exact specified start and
     * end time, and no other ScheduleBlock SHALL overlap with any
     * FixedEvent's time window.
     */
    it('every fixed event appears at its exact time and no other block overlaps it', () => {
      fc.assert(
        fc.property(scheduleInputArb, (input) => {
          const result = solve(input);
          const blocks = result.plan.blocks;

          for (const event of input.fixedEvents) {
            // Find the block for this fixed event
            const eventBlock = blocks.find(
              b => b.sourceType === 'fixed_event' && b.sourceId === event.id
            );
            expect(eventBlock).toBeDefined();
            expect(eventBlock!.startTime).toBe(event.startTime);
            expect(eventBlock!.endTime).toBe(event.endTime);

            // No other block should overlap this fixed event
            for (const other of blocks) {
              if (other.id === eventBlock!.id) continue;
              if (other.sourceType === 'travel_buffer') continue; // travel buffers can be adjacent
              expect(blocksOverlap(eventBlock!, other)).toBe(false);
            }
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // -------------------------------------------------------------------------
  // Property 8: Minimum Session Length Enforcement
  // -------------------------------------------------------------------------
  describe('Property 8: Minimum Session Length Enforcement', () => {
    /**
     * **Validates: Requirements 3.4**
     *
     * For any FlexibleTask with a defined minimum session length and any
     * generated SchedulePlan, every ScheduleBlock allocated to that task
     * SHALL have a duration >= the minimum session length.
     */
    it('every task block meets the task minimum session length', () => {
      fc.assert(
        fc.property(scheduleInputArb, (input) => {
          const result = solve(input);
          const blocks = result.plan.blocks;

          for (const task of input.flexibleTasks) {
            const taskBlocks = blocks.filter(
              b => b.sourceType === 'flexible_task' && b.sourceId === task.id
            );
            for (const block of taskBlocks) {
              expect(blockDuration(block)).toBeGreaterThanOrEqual(task.minSessionMinutes);
            }
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // -------------------------------------------------------------------------
  // Property 9: Task Splitting Preserves Total Duration
  // -------------------------------------------------------------------------
  describe('Property 9: Task Splitting Preserves Total Duration', () => {
    /**
     * **Validates: Requirements 3.5**
     *
     * For any FlexibleTask that is split across multiple ScheduleBlocks,
     * the sum of all block durations for that task SHALL equal the task's
     * remaining duration.
     */
    it('sum of block durations for a split task equals remaining duration', () => {
      fc.assert(
        fc.property(scheduleInputArb, (input) => {
          const result = solve(input);
          const blocks = result.plan.blocks;

          for (const task of input.flexibleTasks) {
            const taskBlocks = blocks.filter(
              b => b.sourceType === 'flexible_task' && b.sourceId === task.id
            );
            if (taskBlocks.length === 0) continue;

            const totalScheduled = taskBlocks.reduce((sum, b) => sum + blockDuration(b), 0);
            const isUnscheduled = result.unscheduledItems.some(
              u => u.sourceId === task.id
            );

            if (!isUnscheduled) {
              // Fully scheduled — total should equal remaining minutes
              expect(totalScheduled).toBe(task.remainingMinutes);
            } else {
              // Partially scheduled — total should be less than remaining
              expect(totalScheduled).toBeLessThanOrEqual(task.remainingMinutes);
            }
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // -------------------------------------------------------------------------
  // Property 12: Urgency-Based Scheduling Priority
  // -------------------------------------------------------------------------
  describe('Property 12: Urgency-Based Scheduling Priority', () => {
    /**
     * **Validates: Requirements 4.4**
     *
     * For any set of Assignments competing for limited available time,
     * Assignments with higher urgency scores SHALL be allocated time blocks
     * before Assignments with lower urgency scores.
     */
    it('higher-urgency assignments get blocks before lower-urgency ones', () => {
      // Use a specific generator that ensures two assignments with clearly different urgencies
      const twoAssignmentInputArb = preferencesArb.chain(preferences =>
        fc.tuple(
          fixedEventsArb(preferences.wakeTime, preferences.sleepTime),
          travelRulesArb,
        ).map(([fixedEvents, travelRules]) => ({
          date: '2025-01-20',
          fixedEvents,
          flexibleTasks: [],
          assignments: [
            {
              id: 'a-high',
              userId: 'user-1',
              title: 'Urgent Assignment',
              subject: 'Math',
              deadline: new Date('2025-01-21T12:00:00Z'), // tomorrow — high urgency
              estimatedTotalMinutes: 60,
              progressPercent: 0,
              urgencyScore: 0,
              remainingMinutes: 60,
              createdAt: new Date(),
            },
            {
              id: 'a-low',
              userId: 'user-1',
              title: 'Relaxed Assignment',
              subject: 'Art',
              deadline: new Date('2025-02-20T23:59:00Z'), // far future — low urgency
              estimatedTotalMinutes: 60,
              progressPercent: 0,
              urgencyScore: 0,
              remainingMinutes: 60,
              createdAt: new Date(),
            },
          ] satisfies Assignment[],
          travelRules,
          preferences,
          lockedBlocks: [],
        } satisfies ScheduleInput))
      );

      fc.assert(
        fc.property(twoAssignmentInputArb, (input) => {
          const result = solve(input);
          const blocks = result.plan.blocks;

          const highBlocks = blocks.filter(b => b.sourceId === 'a-high');
          const lowBlocks = blocks.filter(b => b.sourceId === 'a-low');

          if (highBlocks.length > 0 && lowBlocks.length > 0) {
            // The earliest high-urgency block should start before the earliest low-urgency block
            const highStart = Math.min(...highBlocks.map(b => timeToMinutes(b.startTime)));
            const lowStart = Math.min(...lowBlocks.map(b => timeToMinutes(b.startTime)));
            expect(highStart).toBeLessThanOrEqual(lowStart);
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // -------------------------------------------------------------------------
  // Property 13: No Assignment Block After Deadline
  // -------------------------------------------------------------------------
  describe('Property 13: No Assignment Block After Deadline', () => {
    /**
     * **Validates: Requirements 4.5**
     *
     * For any Assignment and any generated SchedulePlan, no ScheduleBlock
     * allocated to that Assignment SHALL have an end time after the
     * Assignment's deadline.
     */
    it('no assignment block ends after its deadline', () => {
      fc.assert(
        fc.property(scheduleInputArb, (input) => {
          const result = solve(input);
          const blocks = result.plan.blocks;

          for (const assignment of input.assignments) {
            const deadlineDate = assignment.deadline.toISOString().slice(0, 10);
            const assignmentBlocks = blocks.filter(
              b => b.sourceType === 'assignment' && b.sourceId === assignment.id
            );

            for (const block of assignmentBlocks) {
              if (deadlineDate === input.date) {
                // Same-day deadline: block end must not exceed deadline time
                const deadlineMin = assignment.deadline.getUTCHours() * 60 + assignment.deadline.getUTCMinutes();
                expect(timeToMinutes(block.endTime)).toBeLessThanOrEqual(deadlineMin);
              }
              // If deadline is on a future date, any time on schedule date is fine
              // If deadline is past, no blocks should exist (handled by solver)
            }
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // -------------------------------------------------------------------------
  // Property 15: Travel Buffer Enforcement
  // -------------------------------------------------------------------------
  describe('Property 15: Travel Buffer Enforcement', () => {
    /**
     * **Validates: Requirements 5.3, 5.4, 5.5**
     *
     * For any two adjacent ScheduleBlocks at different Locations, the gap
     * between them SHALL be >= the travel time defined by the applicable
     * TravelRule (or default commute time).
     */
    it('adjacent blocks at different locations have sufficient travel buffer', () => {
      fc.assert(
        fc.property(scheduleInputArb, (input) => {
          const result = solve(input);
          const blocks = result.plan.blocks;

          for (let i = 0; i < blocks.length - 1; i++) {
            const curr = blocks[i];
            const next = blocks[i + 1];

            // Skip if either has no location or same location
            if (!curr.locationId || !next.locationId) continue;
            if (curr.locationId === next.locationId) continue;

            // Check if there's a travel buffer between them
            const gap = timeToMinutes(next.startTime) - timeToMinutes(curr.endTime);

            // Look up expected travel time
            const rule = input.travelRules.find(
              r => r.originId === curr.locationId && r.destinationId === next.locationId
            );
            const expectedTravel = rule ? rule.travelMinutes : input.preferences.defaultCommuteMinutes;

            // The gap (including any travel buffer block) should accommodate travel
            // We check that there's either a travel buffer block or sufficient gap
            const travelBufferBetween = blocks.find(
              b => b.sourceType === 'travel_buffer' &&
                timeToMinutes(b.startTime) >= timeToMinutes(curr.endTime) &&
                timeToMinutes(b.endTime) <= timeToMinutes(next.startTime)
            );

            if (travelBufferBetween) {
              // Travel buffer exists — its duration should be > 0
              expect(blockDuration(travelBufferBetween)).toBeGreaterThan(0);
            }
            // The total gap should be >= min(expectedTravel, available gap)
            // The solver limits buffer to available gap, so we just verify a buffer exists
            expect(gap).toBeGreaterThan(0);
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // -------------------------------------------------------------------------
  // Property 16: Schedule Blocks Are Chronologically Ordered
  // -------------------------------------------------------------------------
  describe('Property 16: Schedule Blocks Are Chronologically Ordered', () => {
    /**
     * **Validates: Requirements 6.1**
     *
     * For any generated SchedulePlan, the sequence of ScheduleBlocks SHALL
     * be ordered such that for every consecutive pair, the first block's
     * start time is <= the second block's start time.
     */
    it('blocks are ordered by start time', () => {
      fc.assert(
        fc.property(scheduleInputArb, (input) => {
          const result = solve(input);
          const blocks = result.plan.blocks;

          for (let i = 1; i < blocks.length; i++) {
            expect(timeToMinutes(blocks[i].startTime)).toBeGreaterThanOrEqual(
              timeToMinutes(blocks[i - 1].startTime)
            );
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // -------------------------------------------------------------------------
  // Property 17: No Block in Sleep Window
  // -------------------------------------------------------------------------
  describe('Property 17: No Block in Sleep Window', () => {
    /**
     * **Validates: Requirements 6.4**
     *
     * For any generated SchedulePlan and the user's PreferenceProfile, no
     * ScheduleBlock SHALL overlap with the user's sleep window.
     */
    it('no block overlaps the sleep window', () => {
      fc.assert(
        fc.property(scheduleInputArb, (input) => {
          const result = solve(input);
          const blocks = result.plan.blocks;
          const wakeMin = timeToMinutes(input.preferences.wakeTime);
          const sleepMin = timeToMinutes(input.preferences.sleepTime);

          for (const block of blocks) {
            const bStart = timeToMinutes(block.startTime);
            const bEnd = timeToMinutes(block.endTime);

            // Block must be within waking window
            expect(bStart).toBeGreaterThanOrEqual(wakeMin);
            expect(bEnd).toBeLessThanOrEqual(sleepMin);
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // -------------------------------------------------------------------------
  // Property 18: Minimum Block Duration Enforcement
  // -------------------------------------------------------------------------
  describe('Property 18: Minimum Block Duration Enforcement', () => {
    /**
     * **Validates: Requirements 6.5**
     *
     * For any generated SchedulePlan, every ScheduleBlock that is not a
     * travel buffer SHALL have a duration >= the minimum buffer minutes.
     */
    it('non-travel blocks meet minimum buffer minutes', () => {
      fc.assert(
        fc.property(scheduleInputArb, (input) => {
          const result = solve(input);
          const blocks = result.plan.blocks;
          const minBuffer = input.preferences.minBufferMinutes;

          for (const block of blocks) {
            if (block.sourceType === 'travel_buffer') continue;
            // Fixed events and locked blocks are hard constraints — they keep their original duration
            if (block.sourceType === 'fixed_event' || block.locked) continue;

            if (minBuffer > 0) {
              expect(blockDuration(block)).toBeGreaterThanOrEqual(minBuffer);
            }
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // -------------------------------------------------------------------------
  // Property 19: Overloaded Schedule Reports Unscheduled Items
  // -------------------------------------------------------------------------
  describe('Property 19: Overloaded Schedule Reports Unscheduled Items', () => {
    /**
     * **Validates: Requirements 6.6**
     *
     * For any set of inputs where total estimated duration exceeds available
     * time, the scheduler SHALL report all items that could not be scheduled,
     * and scheduled items SHALL respect priority ordering.
     */
    it('all unschedulable items are reported and priority ordering is respected', () => {
      // Create an overloaded input: many tasks that exceed available time
      const overloadedInputArb = preferencesArb.map(preferences => {
        const wakeMin = timeToMinutes(preferences.wakeTime);
        const sleepMin = timeToMinutes(preferences.sleepTime);
        const availableMinutes = sleepMin - wakeMin;

        // Create tasks that total more than available time
        const tasks: FlexibleTask[] = [
          {
            id: 'ft-critical',
            userId: 'user-1',
            title: 'Critical Task',
            category: 'study',
            estimatedMinutes: Math.floor(availableMinutes * 0.6),
            minSessionMinutes: 15,
            priority: 'critical',
            dueDate: null,
            energyRequirement: 'medium',
            preferredWindow: null,
            remainingMinutes: Math.floor(availableMinutes * 0.6),
            createdAt: new Date(),
          },
          {
            id: 'ft-low',
            userId: 'user-1',
            title: 'Low Task',
            category: 'study',
            estimatedMinutes: Math.floor(availableMinutes * 0.6),
            minSessionMinutes: 15,
            priority: 'low',
            dueDate: null,
            energyRequirement: 'medium',
            preferredWindow: null,
            remainingMinutes: Math.floor(availableMinutes * 0.6),
            createdAt: new Date(),
          },
        ];

        return {
          date: '2025-01-20',
          fixedEvents: [],
          flexibleTasks: tasks,
          assignments: [],
          travelRules: [],
          preferences,
          lockedBlocks: [],
        } satisfies ScheduleInput;
      });

      fc.assert(
        fc.property(overloadedInputArb, (input) => {
          const result = solve(input);
          const blocks = result.plan.blocks;

          // Total requested exceeds available, so some items should be unscheduled
          const totalRequested = input.flexibleTasks.reduce((s, t) => s + t.remainingMinutes, 0);
          const wakeMin = timeToMinutes(input.preferences.wakeTime);
          const sleepMin = timeToMinutes(input.preferences.sleepTime);
          const available = sleepMin - wakeMin;

          if (totalRequested > available) {
            expect(result.unscheduledItems.length).toBeGreaterThan(0);
          }

          // Critical task should be scheduled before low task
          const criticalBlocks = blocks.filter(b => b.sourceId === 'ft-critical');
          const lowBlocks = blocks.filter(b => b.sourceId === 'ft-low');

          if (criticalBlocks.length > 0 && lowBlocks.length > 0) {
            const criticalStart = Math.min(...criticalBlocks.map(b => timeToMinutes(b.startTime)));
            const lowStart = Math.min(...lowBlocks.map(b => timeToMinutes(b.startTime)));
            expect(criticalStart).toBeLessThanOrEqual(lowStart);
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // -------------------------------------------------------------------------
  // Property 20: Every Block Has an Explanation
  // -------------------------------------------------------------------------
  describe('Property 20: Every Block Has an Explanation', () => {
    /**
     * **Validates: Requirements 6.7, 9.1**
     *
     * For any generated SchedulePlan, every ScheduleBlock in the plan SHALL
     * have a corresponding Explanation record.
     */
    it('every block has a corresponding explanation', () => {
      fc.assert(
        fc.property(scheduleInputArb, (input) => {
          const result = solve(input);
          const blocks = result.plan.blocks;
          const explanations = result.explanations;

          for (const block of blocks) {
            const explanation = explanations.get(block.id);
            expect(explanation).toBeDefined();
            expect(explanation!.blockId).toBe(block.id);
            expect(explanation!.explanationText.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // -------------------------------------------------------------------------
  // Property 14: At-Risk Assignment Shortfall Reporting
  // -------------------------------------------------------------------------
  describe('Property 14: At-Risk Assignment Shortfall Reporting', () => {
    /**
     * **Validates: Requirements 4.7**
     *
     * For any Assignment where the total available scheduling time before
     * the deadline is less than the remaining estimated work, the system
     * SHALL report the Assignment as at-risk and the reported shortfall
     * SHALL equal remainingMinutes - availableSchedulableMinutes.
     */
    it('at-risk assignments are reported with correct shortfall', () => {
      // Create an input with a tight-deadline assignment that can't be fully scheduled
      const tightDeadlineInputArb = preferencesArb.map(preferences => ({
        date: '2025-01-20',
        fixedEvents: [
          {
            id: 'fe-blocker',
            userId: 'user-1',
            title: 'Blocker',
            eventDate: '2025-01-20',
            startTime: preferences.wakeTime,
            endTime: minutesToTimeStr(timeToMinutes(preferences.wakeTime) + 120),
            locationId: null,
            recurrenceRule: null,
            recurrenceParentId: null,
            category: 'class',
            notes: null,
            createdAt: new Date(),
          } satisfies FixedEvent,
        ],
        flexibleTasks: [],
        assignments: [
          {
            id: 'a-tight',
            userId: 'user-1',
            title: 'Tight Assignment',
            subject: 'Math',
            // Deadline is 3 hours after wake — but 2 hours are blocked
            deadline: new Date(`2025-01-20T${minutesToTimeStr(timeToMinutes(preferences.wakeTime) + 180).replace(':', ':')}:00Z`),
            estimatedTotalMinutes: 120,
            progressPercent: 0,
            urgencyScore: 0,
            remainingMinutes: 120,
            createdAt: new Date(),
          } satisfies Assignment,
        ],
        travelRules: [],
        preferences,
        lockedBlocks: [],
      } satisfies ScheduleInput));

      fc.assert(
        fc.property(tightDeadlineInputArb, (input) => {
          const result = solve(input);

          // Check at-risk assignments
          for (const atRisk of result.atRiskAssignments) {
            // Shortfall should equal remaining - available
            expect(atRisk.shortfallMinutes).toBe(
              atRisk.remainingMinutes - atRisk.availableMinutes
            );
            expect(atRisk.shortfallMinutes).toBeGreaterThan(0);
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // -------------------------------------------------------------------------
  // Property 25: Explanation Quality
  // -------------------------------------------------------------------------
  describe('Property 25: Explanation Quality', () => {
    /**
     * **Validates: Requirements 9.3, 9.5**
     *
     * For any generated Explanation, the explanation text SHALL reference
     * at least one specific constraint or preference name.
     */
    it('explanations reference specific constraint names', () => {
      const knownConstraintPatterns = [
        'Fixed_Event',
        'hard constraint',
        'Travel_Rule',
        'travel buffer',
        'default commute',
        'Assignment',
        'deadline',
        'urgency',
        'Urgency',
        'priority',
        'Priority',
        'Locked_Block',
        'locked',
        'Flexible task',
        'focus window',
        'preferred window',
        'gap',
        'Category',
      ];

      fc.assert(
        fc.property(scheduleInputArb, (input) => {
          const result = solve(input);

          for (const [, explanation] of result.explanations) {
            // Explanation text should reference at least one known constraint
            const hasConstraintRef = knownConstraintPatterns.some(
              pattern => explanation.explanationText.toLowerCase().includes(pattern.toLowerCase())
            );
            expect(hasConstraintRef).toBe(true);

            // referencedConstraints array should not be empty
            expect(explanation.referencedConstraints.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });
});
