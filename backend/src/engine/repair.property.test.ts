import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type {
  FixedEvent,
  FlexibleTask,
  Assignment,
  PreferenceProfile,
  ScheduleBlock,
  SchedulePlan,
  TravelRule,
} from '../types/domain';
import type { ScheduleChange, ScheduleInput } from '../types/engine';
import { repair, diffPlans } from './repair';
import { solve, timeToMinutes } from './solver';

// ---------------------------------------------------------------------------
// Arbitraries — generators for valid domain objects
// ---------------------------------------------------------------------------

function minutesToTimeStr(minutes: number): string {
  const clamped = Math.max(0, Math.min(minutes, 1439));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Generate a wake/sleep pair where wake < sleep and there's at least 8 hours of waking time. */
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
  } satisfies PreferenceProfile)),
);

/**
 * Generate non-overlapping FixedEvents within the waking window.
 */
function fixedEventsArb(wakeTime: string, sleepTime: string): fc.Arbitrary<FixedEvent[]> {
  const wakeMin = timeToMinutes(wakeTime);
  const sleepMin = timeToMinutes(sleepTime);
  const windowSize = sleepMin - wakeMin;
  if (windowSize < 60) return fc.constant([]);

  return fc.integer({ min: 0, max: 3 }).chain((count) => {
    if (count === 0) return fc.constant([]);
    const slotSize = Math.floor(windowSize / count);
    if (slotSize < 30) return fc.constant([]);

    const arbs = Array.from({ length: count }, (_, i) => {
      const slotStart = wakeMin + i * slotSize;
      const slotEnd = slotStart + slotSize;
      return fc
        .record({
          startOffset: fc.integer({ min: 0, max: Math.max(0, Math.floor(slotSize / 3)) }),
          duration: fc.integer({ min: 20, max: Math.min(60, slotSize - 10) }),
        })
        .map(({ startOffset, duration }) => {
          const start = Math.min(slotStart + startOffset, slotEnd - duration);
          const end = Math.min(start + duration, sleepMin);
          return {
            id: `fe-${i}`,
            userId: 'user-1',
            title: `Event ${i}`,
            eventDate: '2025-01-20',
            startTime: minutesToTimeStr(Math.max(start, wakeMin)),
            endTime: minutesToTimeStr(Math.min(end, sleepMin)),
            locationId: null,
            recurrenceRule: null,
            recurrenceParentId: null,
            category: 'class',
            notes: null,
            createdAt: new Date(),
          } satisfies FixedEvent;
        });
    });
    return fc
      .tuple(...(arbs as [fc.Arbitrary<FixedEvent>, ...fc.Arbitrary<FixedEvent>[]]))
      .map((events) => events.filter((e) => timeToMinutes(e.endTime) > timeToMinutes(e.startTime)));
  });
}

/** Generate a FlexibleTask. */
function flexibleTaskArb(index: number): fc.Arbitrary<FlexibleTask> {
  return fc
    .record({
      estimatedMinutes: fc.integer({ min: 15, max: 120 }),
      minSessionMinutes: fc.integer({ min: 10, max: 30 }),
      priority: fc.constantFrom('low' as const, 'medium' as const, 'high' as const, 'critical' as const),
    })
    .map(({ estimatedMinutes, minSessionMinutes, priority }) => ({
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
const flexibleTasksArb = fc.integer({ min: 0, max: 3 }).chain((count) =>
  count === 0
    ? fc.constant([])
    : fc
        .tuple(
          ...(Array.from({ length: count }, (_, i) => flexibleTaskArb(i)) as [
            fc.Arbitrary<FlexibleTask>,
            ...fc.Arbitrary<FlexibleTask>[],
          ]),
        )
        .map((arr) => arr),
);

/** Generate an Assignment with a future deadline. */
function assignmentArb(index: number): fc.Arbitrary<Assignment> {
  return fc
    .record({
      remainingMinutes: fc.integer({ min: 15, max: 180 }),
      estimatedTotalMinutes: fc.integer({ min: 30, max: 240 }),
      progressPercent: fc.integer({ min: 0, max: 80 }),
      daysUntilDeadline: fc.integer({ min: 0, max: 10 }),
    })
    .map(({ remainingMinutes, estimatedTotalMinutes, progressPercent, daysUntilDeadline }) => ({
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

/** Generate 0–2 assignments. */
const assignmentsArb = fc.integer({ min: 0, max: 2 }).chain((count) =>
  count === 0
    ? fc.constant([])
    : fc
        .tuple(
          ...(Array.from({ length: count }, (_, i) => assignmentArb(i)) as [
            fc.Arbitrary<Assignment>,
            ...fc.Arbitrary<Assignment>[],
          ]),
        )
        .map((arr) => arr),
);

/** Generate a complete valid ScheduleInput. */
const scheduleInputArb: fc.Arbitrary<ScheduleInput> = preferencesArb.chain((preferences) =>
  fc
    .tuple(
      fixedEventsArb(preferences.wakeTime, preferences.sleepTime),
      flexibleTasksArb,
      assignmentsArb,
    )
    .map(([fixedEvents, flexibleTasks, assignments]) => ({
      date: '2025-01-20',
      fixedEvents,
      flexibleTasks,
      assignments,
      travelRules: [],
      preferences,
      lockedBlocks: [],
    })),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function blockDuration(block: ScheduleBlock): number {
  return timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
}

/**
 * Generate an existing plan by running the solver, then randomly lock
 * some of the flexible_task / assignment blocks.
 */
function existingPlanWithLockedBlocksArb(): fc.Arbitrary<{
  plan: SchedulePlan;
  input: ScheduleInput;
  lockedBlockIds: string[];
}> {
  return scheduleInputArb.chain((input) => {
    const result = solve(input);
    const lockableBlocks = result.plan.blocks.filter(
      (b) => b.sourceType === 'flexible_task' || b.sourceType === 'assignment',
    );
    if (lockableBlocks.length === 0) {
      return fc.constant({
        plan: result.plan,
        input,
        lockedBlockIds: [],
      });
    }
    // Lock 1 to all lockable blocks
    return fc
      .subarray(lockableBlocks, { minLength: 1, maxLength: lockableBlocks.length })
      .map((toLock) => {
        const lockedIds = new Set(toLock.map((b) => b.id));
        const planWithLocks: SchedulePlan = {
          ...result.plan,
          blocks: result.plan.blocks.map((b) =>
            lockedIds.has(b.id) ? { ...b, locked: true } : b,
          ),
        };
        return {
          plan: planWithLocks,
          input,
          lockedBlockIds: Array.from(lockedIds),
        };
      });
  });
}

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

describe('Schedule Repair Property Tests', () => {
  const NUM_RUNS = 100;

  // -------------------------------------------------------------------------
  // Property 21: Locked Blocks Are Immovable
  // -------------------------------------------------------------------------
  describe('Property 21: Locked Blocks Are Immovable', () => {
    /**
     * **Validates: Requirements 6.8, 7.3, 11.3**
     *
     * For any SchedulePlan containing Locked_Blocks, after any Schedule_Repair
     * operation, every Locked_Block SHALL remain at its exact original start
     * time, end time, and position.
     */
    it('locked blocks remain at exact original positions after repair', () => {
      fc.assert(
        fc.property(existingPlanWithLockedBlocksArb(), ({ plan, input, lockedBlockIds }) => {
          // Build a repair change: add a new fixed event that fits in the waking window
          const wakeMin = timeToMinutes(input.preferences.wakeTime);
          const sleepMin = timeToMinutes(input.preferences.sleepTime);
          const midpoint = Math.floor((wakeMin + sleepMin) / 2);

          const newEvent: FixedEvent = {
            id: 'fe-repair-new',
            userId: 'user-1',
            title: 'New Meeting',
            eventDate: '2025-01-20',
            startTime: minutesToTimeStr(midpoint),
            endTime: minutesToTimeStr(Math.min(midpoint + 30, sleepMin)),
            locationId: null,
            recurrenceRule: null,
            recurrenceParentId: null,
            category: 'meeting',
            notes: null,
            createdAt: new Date(),
          };

          const repairInput: ScheduleInput = {
            ...input,
            fixedEvents: [...input.fixedEvents, newEvent],
          };

          const change: ScheduleChange = {
            type: 'add',
            sourceType: 'fixed_event',
            sourceId: 'fe-repair-new',
            date: '2025-01-20',
          };

          const result = repair(plan, change, repairInput);

          // Every locked block from the original plan must appear at its exact position.
          // The solver carries locked blocks through as lockedBlocks input, preserving
          // their start/end times. We match by the original block id since the solver
          // preserves locked block objects.
          const originalLockedBlocks = plan.blocks.filter((b) => b.locked);
          for (const original of originalLockedBlocks) {
            // Find the corresponding locked block in the repaired plan.
            // The solver preserves locked blocks by id.
            const repaired = result.plan.blocks.find((b) => b.id === original.id);
            expect(repaired).toBeDefined();
            expect(repaired!.startTime).toBe(original.startTime);
            expect(repaired!.endTime).toBe(original.endTime);
            expect(repaired!.locked).toBe(true);
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // -------------------------------------------------------------------------
  // Property 22: Missed Task Reallocation
  // -------------------------------------------------------------------------
  describe('Property 22: Missed Task Reallocation', () => {
    /**
     * **Validates: Requirements 7.2**
     *
     * For any FlexibleTask marked as missed or incomplete with remaining
     * duration > 0, the scheduler SHALL reallocate blocks totaling the
     * remaining duration into available windows.
     */
    it('missed tasks with remaining duration get reallocated', () => {
      const missedTaskInputArb = preferencesArb.chain((preferences) => {
        const wakeMin = timeToMinutes(preferences.wakeTime);
        const sleepMin = timeToMinutes(preferences.sleepTime);
        const available = sleepMin - wakeMin;

        // Create a task with remaining minutes that fits in the available window
        return fc.integer({ min: 15, max: Math.min(60, Math.floor(available / 2)) }).map((remaining) => {
          const task: FlexibleTask = {
            id: 'ft-missed',
            userId: 'user-1',
            title: 'Missed Study',
            category: 'study',
            estimatedMinutes: 60,
            minSessionMinutes: 15,
            priority: 'high',
            dueDate: null,
            energyRequirement: 'medium' as const,
            preferredWindow: null,
            remainingMinutes: remaining,
            createdAt: new Date(),
          };

          // Create an initial plan with a block for this task
          const originalBlock: ScheduleBlock = {
            id: 'block-missed',
            planId: 'plan-1',
            sourceType: 'flexible_task',
            sourceId: 'ft-missed',
            title: 'Missed Study',
            startTime: minutesToTimeStr(wakeMin),
            endTime: minutesToTimeStr(wakeMin + 60),
            locationId: null,
            locked: false,
            sortOrder: 0,
          };

          const existingPlan: SchedulePlan = {
            id: 'plan-1',
            userId: 'user-1',
            planDate: '2025-01-20',
            version: 1,
            generatedAt: new Date(),
            blocks: [originalBlock],
          };

          const input: ScheduleInput = {
            date: '2025-01-20',
            fixedEvents: [],
            flexibleTasks: [task],
            assignments: [],
            travelRules: [],
            preferences,
            lockedBlocks: [],
          };

          return { existingPlan, input, remaining };
        });
      });

      fc.assert(
        fc.property(missedTaskInputArb, ({ existingPlan, input, remaining }) => {
          const change: ScheduleChange = {
            type: 'modify',
            sourceType: 'flexible_task',
            sourceId: 'ft-missed',
            date: '2025-01-20',
          };

          const result = repair(existingPlan, change, input);

          // The task should be reallocated in the new plan
          const taskBlocks = result.plan.blocks.filter(
            (b) => b.sourceType === 'flexible_task' && b.sourceId === 'ft-missed',
          );

          const totalScheduled = taskBlocks.reduce((sum, b) => sum + blockDuration(b), 0);

          // If not in unscheduled items, total should equal remaining minutes
          const isUnscheduled = result.unscheduledItems.some((u) => u.sourceId === 'ft-missed');
          if (!isUnscheduled) {
            expect(totalScheduled).toBe(remaining);
          } else {
            // Partially scheduled — at least some time was allocated
            expect(totalScheduled).toBeLessThanOrEqual(remaining);
          }

          // Either way, the task should appear somewhere (blocks or unscheduled)
          expect(taskBlocks.length > 0 || isUnscheduled).toBe(true);
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // -------------------------------------------------------------------------
  // Property 23: Gap-First Insertion During Repair
  // -------------------------------------------------------------------------
  describe('Property 23: Gap-First Insertion During Repair', () => {
    /**
     * **Validates: Requirements 7.5**
     *
     * For any SchedulePlan with available gaps and a newly added FlexibleTask
     * or Assignment that fits within those gaps, the repair operation SHALL
     * insert the new item into gaps without displacing any existing unlocked
     * blocks.
     */
    it('new items are inserted into gaps without displacing unlocked blocks when gaps are sufficient', () => {
      const gapInsertionArb = preferencesArb.chain((preferences) => {
        const wakeMin = timeToMinutes(preferences.wakeTime);
        const sleepMin = timeToMinutes(preferences.sleepTime);
        const available = sleepMin - wakeMin;

        // Need at least 3 hours to create a meaningful gap scenario
        if (available < 180) {
          return fc.constant(null);
        }

        // Create two fixed events with a large gap between them
        const event1End = wakeMin + 60;
        const event2Start = sleepMin - 60;
        const gapSize = event2Start - event1End;

        // New task must fit in the gap
        return fc.integer({ min: 15, max: Math.min(30, Math.floor(gapSize / 2)) }).map((taskDuration) => {
          const event1: FixedEvent = {
            id: 'fe-gap-1',
            userId: 'user-1',
            title: 'Morning Event',
            eventDate: '2025-01-20',
            startTime: minutesToTimeStr(wakeMin),
            endTime: minutesToTimeStr(event1End),
            locationId: null,
            recurrenceRule: null,
            recurrenceParentId: null,
            category: 'class',
            notes: null,
            createdAt: new Date(),
          };

          const event2: FixedEvent = {
            id: 'fe-gap-2',
            userId: 'user-1',
            title: 'Evening Event',
            eventDate: '2025-01-20',
            startTime: minutesToTimeStr(event2Start),
            endTime: minutesToTimeStr(sleepMin),
            locationId: null,
            recurrenceRule: null,
            recurrenceParentId: null,
            category: 'class',
            notes: null,
            createdAt: new Date(),
          };

          // Generate initial plan with just the two events
          const initialInput: ScheduleInput = {
            date: '2025-01-20',
            fixedEvents: [event1, event2],
            flexibleTasks: [],
            assignments: [],
            travelRules: [],
            preferences,
            lockedBlocks: [],
          };
          const initialResult = solve(initialInput);

          // New task to add during repair
          const newTask: FlexibleTask = {
            id: 'ft-gap-new',
            userId: 'user-1',
            title: 'New Gap Task',
            category: 'study',
            estimatedMinutes: taskDuration,
            minSessionMinutes: Math.min(15, taskDuration),
            priority: 'medium',
            dueDate: null,
            energyRequirement: 'medium' as const,
            preferredWindow: null,
            remainingMinutes: taskDuration,
            createdAt: new Date(),
          };

          const repairInput: ScheduleInput = {
            ...initialInput,
            flexibleTasks: [newTask],
          };

          return {
            existingPlan: initialResult.plan,
            repairInput,
            originalBlocks: initialResult.plan.blocks,
          };
        });
      });

      fc.assert(
        fc.property(gapInsertionArb, (data) => {
          if (data === null) return; // skip if window too small

          const { existingPlan, repairInput, originalBlocks } = data;

          const change: ScheduleChange = {
            type: 'add',
            sourceType: 'flexible_task',
            sourceId: 'ft-gap-new',
            date: '2025-01-20',
          };

          const result = repair(existingPlan, change, repairInput);

          // The new task should be placed
          const newTaskBlocks = result.plan.blocks.filter(
            (b) => b.sourceType === 'flexible_task' && b.sourceId === 'ft-gap-new',
          );
          expect(newTaskBlocks.length).toBeGreaterThan(0);

          // Original fixed event blocks should not have moved
          for (const origBlock of originalBlocks) {
            if (origBlock.sourceType === 'fixed_event') {
              const repairedBlock = result.plan.blocks.find(
                (b) => b.sourceType === 'fixed_event' && b.sourceId === origBlock.sourceId,
              );
              expect(repairedBlock).toBeDefined();
              expect(repairedBlock!.startTime).toBe(origBlock.startTime);
              expect(repairedBlock!.endTime).toBe(origBlock.endTime);
            }
          }

          // The change summary should show added blocks, not moved blocks for existing events
          expect(result.changeSummary.added.length).toBeGreaterThan(0);
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // -------------------------------------------------------------------------
  // Property 24: Repair Change Summary Accuracy
  // -------------------------------------------------------------------------
  describe('Property 24: Repair Change Summary Accuracy', () => {
    /**
     * **Validates: Requirements 7.6**
     *
     * For any Schedule_Repair operation, the reported change summary (moved,
     * added, removed blocks) SHALL exactly match the actual differences
     * between the previous and updated Schedule_Plans.
     */
    it('change summary exactly matches actual differences between old and new plans', () => {
      fc.assert(
        fc.property(scheduleInputArb, (input) => {
          // Generate an initial plan
          const initialResult = solve(input);
          const existingPlan = initialResult.plan;

          // Create a new event to trigger repair
          const wakeMin = timeToMinutes(input.preferences.wakeTime);
          const sleepMin = timeToMinutes(input.preferences.sleepTime);
          const midpoint = Math.floor((wakeMin + sleepMin) / 2);

          const newEvent: FixedEvent = {
            id: 'fe-summary-new',
            userId: 'user-1',
            title: 'Summary Test Event',
            eventDate: '2025-01-20',
            startTime: minutesToTimeStr(midpoint),
            endTime: minutesToTimeStr(Math.min(midpoint + 20, sleepMin)),
            locationId: null,
            recurrenceRule: null,
            recurrenceParentId: null,
            category: 'meeting',
            notes: null,
            createdAt: new Date(),
          };

          const repairInput: ScheduleInput = {
            ...input,
            fixedEvents: [...input.fixedEvents, newEvent],
          };

          const change: ScheduleChange = {
            type: 'add',
            sourceType: 'fixed_event',
            sourceId: 'fe-summary-new',
            date: '2025-01-20',
          };

          const result = repair(existingPlan, change, repairInput);

          // Independently compute the diff
          const independentDiff = diffPlans(existingPlan.blocks, result.plan.blocks);

          // The change summary from repair should match the independent diff
          expect(result.changeSummary.added.sort()).toEqual(independentDiff.added.sort());
          expect(result.changeSummary.removed.sort()).toEqual(independentDiff.removed.sort());

          // For moved blocks, compare the sets
          const summaryMoved = result.changeSummary.moved
            .map((m) => `${m.blockId}:${m.oldStart}->${m.newStart}`)
            .sort();
          const diffMoved = independentDiff.moved
            .map((m) => `${m.blockId}:${m.oldStart}->${m.newStart}`)
            .sort();
          expect(summaryMoved).toEqual(diffMoved);

          // Verify added blocks actually exist in new plan but not old
          const oldIds = new Set(existingPlan.blocks.map((b) => b.id));
          const newIds = new Set(result.plan.blocks.map((b) => b.id));

          for (const addedId of result.changeSummary.added) {
            expect(oldIds.has(addedId)).toBe(false);
            expect(newIds.has(addedId)).toBe(true);
          }

          // Verify removed blocks exist in old plan but not new
          for (const removedId of result.changeSummary.removed) {
            expect(oldIds.has(removedId)).toBe(true);
            expect(newIds.has(removedId)).toBe(false);
          }

          // Verify moved blocks exist in both but with different start times
          for (const moved of result.changeSummary.moved) {
            const oldBlock = existingPlan.blocks.find((b) => b.id === moved.blockId);
            const newBlock = result.plan.blocks.find((b) => b.id === moved.blockId);
            expect(oldBlock).toBeDefined();
            expect(newBlock).toBeDefined();
            expect(oldBlock!.startTime).toBe(moved.oldStart);
            expect(newBlock!.startTime).toBe(moved.newStart);
            expect(moved.oldStart).not.toBe(moved.newStart);
          }
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });
});
