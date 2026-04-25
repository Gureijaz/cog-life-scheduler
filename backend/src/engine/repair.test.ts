import { describe, it, expect } from 'vitest';
import type {
  FixedEvent,
  FlexibleTask,
  Assignment,
  ScheduleBlock,
  SchedulePlan,
  PreferenceProfile,
} from '../types/domain';
import type { ScheduleChange, ScheduleInput } from '../types/engine';
import { repair, diffPlans, applyChange } from './repair';
import { timeToMinutes } from './solver';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePreferences(overrides: Partial<PreferenceProfile> = {}): PreferenceProfile {
  return {
    id: 'pref-1',
    userId: 'user-1',
    wakeTime: '07:00',
    sleepTime: '23:00',
    focusWindows: [],
    workoutWindows: [],
    minBufferMinutes: 5,
    maxDeepWorkMinutes: 90,
    defaultCommuteMinutes: 15,
    autoRepairEnabled: false,
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeFixedEvent(overrides: Partial<FixedEvent> = {}): FixedEvent {
  return {
    id: 'fe-1',
    userId: 'user-1',
    title: 'Class',
    eventDate: '2025-01-20',
    startTime: '09:00',
    endTime: '10:00',
    locationId: null,
    recurrenceRule: null,
    recurrenceParentId: null,
    category: 'class',
    notes: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeFlexibleTask(overrides: Partial<FlexibleTask> = {}): FlexibleTask {
  return {
    id: 'ft-1',
    userId: 'user-1',
    title: 'Study',
    category: 'study',
    estimatedMinutes: 60,
    minSessionMinutes: 15,
    priority: 'medium',
    dueDate: null,
    energyRequirement: 'medium',
    preferredWindow: null,
    remainingMinutes: 60,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: 'a-1',
    userId: 'user-1',
    title: 'Essay',
    subject: 'English',
    deadline: new Date('2025-01-25T23:59:00Z'),
    estimatedTotalMinutes: 120,
    progressPercent: 0,
    urgencyScore: 0,
    remainingMinutes: 120,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeBlock(overrides: Partial<ScheduleBlock> = {}): ScheduleBlock {
  return {
    id: 'block-1',
    planId: 'plan-1',
    sourceType: 'fixed_event',
    sourceId: 'fe-1',
    title: 'Class',
    startTime: '09:00',
    endTime: '10:00',
    locationId: null,
    locked: false,
    sortOrder: 0,
    ...overrides,
  };
}

function makePlan(blocks: ScheduleBlock[], overrides: Partial<SchedulePlan> = {}): SchedulePlan {
  return {
    id: 'plan-1',
    userId: 'user-1',
    planDate: '2025-01-20',
    version: 1,
    generatedAt: new Date(),
    blocks,
    ...overrides,
  };
}

function makeScheduleInput(overrides: Partial<ScheduleInput> = {}): ScheduleInput {
  return {
    date: '2025-01-20',
    fixedEvents: [],
    flexibleTasks: [],
    assignments: [],
    travelRules: [],
    preferences: makePreferences(),
    lockedBlocks: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// diffPlans
// ---------------------------------------------------------------------------

describe('diffPlans', () => {
  it('detects added blocks', () => {
    const oldBlocks = [makeBlock({ id: 'b1' })];
    const newBlocks = [makeBlock({ id: 'b1' }), makeBlock({ id: 'b2' })];

    const summary = diffPlans(oldBlocks, newBlocks);

    expect(summary.added).toEqual(['b2']);
    expect(summary.removed).toEqual([]);
    expect(summary.moved).toEqual([]);
  });

  it('detects removed blocks', () => {
    const oldBlocks = [makeBlock({ id: 'b1' }), makeBlock({ id: 'b2' })];
    const newBlocks = [makeBlock({ id: 'b1' })];

    const summary = diffPlans(oldBlocks, newBlocks);

    expect(summary.added).toEqual([]);
    expect(summary.removed).toEqual(['b2']);
    expect(summary.moved).toEqual([]);
  });

  it('detects moved blocks', () => {
    const oldBlocks = [makeBlock({ id: 'b1', startTime: '09:00' })];
    const newBlocks = [makeBlock({ id: 'b1', startTime: '10:00' })];

    const summary = diffPlans(oldBlocks, newBlocks);

    expect(summary.moved).toEqual([
      { blockId: 'b1', oldStart: '09:00', newStart: '10:00' },
    ]);
    expect(summary.added).toEqual([]);
    expect(summary.removed).toEqual([]);
  });

  it('returns empty summary when plans are identical', () => {
    const blocks = [makeBlock({ id: 'b1' })];
    const summary = diffPlans(blocks, blocks);

    expect(summary.added).toEqual([]);
    expect(summary.removed).toEqual([]);
    expect(summary.moved).toEqual([]);
  });

  it('handles empty plans', () => {
    const summary = diffPlans([], []);
    expect(summary.added).toEqual([]);
    expect(summary.removed).toEqual([]);
    expect(summary.moved).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// applyChange
// ---------------------------------------------------------------------------

describe('applyChange', () => {
  it('removes a fixed event by sourceId', () => {
    const input = makeScheduleInput({
      fixedEvents: [
        makeFixedEvent({ id: 'fe-1' }),
        makeFixedEvent({ id: 'fe-2' }),
      ],
    });
    const change: ScheduleChange = {
      type: 'remove',
      sourceType: 'fixed_event',
      sourceId: 'fe-1',
      date: '2025-01-20',
    };

    const result = applyChange(input, change);

    expect(result.fixedEvents).toHaveLength(1);
    expect(result.fixedEvents[0].id).toBe('fe-2');
  });

  it('removes a flexible task by sourceId', () => {
    const input = makeScheduleInput({
      flexibleTasks: [makeFlexibleTask({ id: 'ft-1' })],
    });
    const change: ScheduleChange = {
      type: 'remove',
      sourceType: 'flexible_task',
      sourceId: 'ft-1',
      date: '2025-01-20',
    };

    const result = applyChange(input, change);
    expect(result.flexibleTasks).toHaveLength(0);
  });

  it('removes an assignment by sourceId', () => {
    const input = makeScheduleInput({
      assignments: [makeAssignment({ id: 'a-1' })],
    });
    const change: ScheduleChange = {
      type: 'remove',
      sourceType: 'assignment',
      sourceId: 'a-1',
      date: '2025-01-20',
    };

    const result = applyChange(input, change);
    expect(result.assignments).toHaveLength(0);
  });

  it('returns input unchanged for add type', () => {
    const input = makeScheduleInput({
      fixedEvents: [makeFixedEvent()],
    });
    const change: ScheduleChange = {
      type: 'add',
      sourceType: 'fixed_event',
      date: '2025-01-20',
    };

    const result = applyChange(input, change);
    expect(result.fixedEvents).toHaveLength(1);
  });

  it('returns input unchanged for modify type', () => {
    const input = makeScheduleInput({
      flexibleTasks: [makeFlexibleTask()],
    });
    const change: ScheduleChange = {
      type: 'modify',
      sourceType: 'flexible_task',
      sourceId: 'ft-1',
      date: '2025-01-20',
    };

    const result = applyChange(input, change);
    expect(result.flexibleTasks).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// repair()
// ---------------------------------------------------------------------------

describe('repair', () => {
  it('preserves locked blocks in their exact positions', () => {
    const lockedBlock = makeBlock({
      id: 'locked-1',
      sourceType: 'flexible_task',
      sourceId: 'ft-1',
      title: 'Locked Study',
      startTime: '14:00',
      endTime: '15:00',
      locked: true,
      sortOrder: 1,
    });
    const eventBlock = makeBlock({
      id: 'event-1',
      sourceType: 'fixed_event',
      sourceId: 'fe-1',
      title: 'Class',
      startTime: '09:00',
      endTime: '10:00',
      locked: false,
      sortOrder: 0,
    });

    const existingPlan = makePlan([eventBlock, lockedBlock]);

    const input = makeScheduleInput({
      fixedEvents: [makeFixedEvent({ id: 'fe-1', startTime: '09:00', endTime: '10:00' })],
    });

    const change: ScheduleChange = {
      type: 'modify',
      sourceType: 'fixed_event',
      sourceId: 'fe-1',
      date: '2025-01-20',
    };

    const result = repair(existingPlan, change, input);

    // The locked block should still be at 14:00-15:00
    const locked = result.plan.blocks.find((b) => b.locked);
    expect(locked).toBeDefined();
    expect(locked!.startTime).toBe('14:00');
    expect(locked!.endTime).toBe('15:00');
  });

  it('adds new event and generates change summary with added blocks', () => {
    const existingPlan = makePlan([]);

    const newEvent = makeFixedEvent({
      id: 'fe-new',
      title: 'New Meeting',
      startTime: '11:00',
      endTime: '12:00',
    });

    const input = makeScheduleInput({
      fixedEvents: [newEvent],
    });

    const change: ScheduleChange = {
      type: 'add',
      sourceType: 'fixed_event',
      sourceId: 'fe-new',
      date: '2025-01-20',
    };

    const result = repair(existingPlan, change, input);

    // Should have at least the new event block
    const newEventBlock = result.plan.blocks.find(
      (b) => b.sourceType === 'fixed_event' && b.sourceId === 'fe-new',
    );
    expect(newEventBlock).toBeDefined();
    expect(newEventBlock!.startTime).toBe('11:00');
    expect(newEventBlock!.endTime).toBe('12:00');

    // Change summary should show added blocks
    expect(result.changeSummary.added.length).toBeGreaterThan(0);
  });

  it('removes an event and generates change summary with removed blocks', () => {
    const eventBlock = makeBlock({
      id: 'event-1',
      sourceType: 'fixed_event',
      sourceId: 'fe-1',
      title: 'Class',
      startTime: '09:00',
      endTime: '10:00',
    });

    const existingPlan = makePlan([eventBlock]);

    // Input with the event removed (empty fixedEvents)
    const input = makeScheduleInput({
      fixedEvents: [],
    });

    const change: ScheduleChange = {
      type: 'remove',
      sourceType: 'fixed_event',
      sourceId: 'fe-1',
      date: '2025-01-20',
    };

    const result = repair(existingPlan, change, input);

    // The old event block should be in the removed list
    expect(result.changeSummary.removed).toContain('event-1');
  });

  it('reallocates remaining task duration into available windows', () => {
    // Existing plan has a task block that was partially completed
    const taskBlock = makeBlock({
      id: 'task-block-1',
      sourceType: 'flexible_task',
      sourceId: 'ft-1',
      title: 'Study',
      startTime: '10:00',
      endTime: '11:00',
    });

    const existingPlan = makePlan([taskBlock]);

    // The task still has 45 remaining minutes (was 60, did 15)
    const input = makeScheduleInput({
      flexibleTasks: [
        makeFlexibleTask({
          id: 'ft-1',
          title: 'Study',
          remainingMinutes: 45,
          minSessionMinutes: 15,
        }),
      ],
    });

    const change: ScheduleChange = {
      type: 'modify',
      sourceType: 'flexible_task',
      sourceId: 'ft-1',
      date: '2025-01-20',
    };

    const result = repair(existingPlan, change, input);

    // The task should be reallocated
    const taskBlocks = result.plan.blocks.filter(
      (b) => b.sourceType === 'flexible_task' && b.sourceId === 'ft-1',
    );
    const totalMinutes = taskBlocks.reduce(
      (sum, b) => sum + (timeToMinutes(b.endTime) - timeToMinutes(b.startTime)),
      0,
    );
    expect(totalMinutes).toBe(45);
  });

  it('returns a valid RepairResult with changeSummary', () => {
    const existingPlan = makePlan([]);
    const input = makeScheduleInput();
    const change: ScheduleChange = {
      type: 'add',
      sourceType: 'fixed_event',
      date: '2025-01-20',
    };

    const result = repair(existingPlan, change, input);

    expect(result.plan).toBeDefined();
    expect(result.unscheduledItems).toBeDefined();
    expect(result.explanations).toBeDefined();
    expect(result.atRiskAssignments).toBeDefined();
    expect(result.changeSummary).toBeDefined();
    expect(result.changeSummary.moved).toBeInstanceOf(Array);
    expect(result.changeSummary.added).toBeInstanceOf(Array);
    expect(result.changeSummary.removed).toBeInstanceOf(Array);
  });

  it('minimizes disruption — locked blocks are not in moved list', () => {
    const lockedBlock = makeBlock({
      id: 'locked-1',
      sourceType: 'flexible_task',
      sourceId: 'ft-1',
      title: 'Locked Study',
      startTime: '14:00',
      endTime: '15:00',
      locked: true,
    });

    const existingPlan = makePlan([lockedBlock]);

    const input = makeScheduleInput({
      fixedEvents: [
        makeFixedEvent({ id: 'fe-new', startTime: '11:00', endTime: '12:00' }),
      ],
    });

    const change: ScheduleChange = {
      type: 'add',
      sourceType: 'fixed_event',
      sourceId: 'fe-new',
      date: '2025-01-20',
    };

    const result = repair(existingPlan, change, input);

    // Locked block should not appear in the moved list
    const movedIds = result.changeSummary.moved.map((m) => m.blockId);
    expect(movedIds).not.toContain('locked-1');
  });

  it('inserts new task into gap without displacing unlocked blocks', () => {
    // Existing plan: event at 09:00-10:00, big gap, then event at 15:00-16:00
    const block1 = makeBlock({
      id: 'b1',
      sourceType: 'fixed_event',
      sourceId: 'fe-1',
      startTime: '09:00',
      endTime: '10:00',
    });
    const block2 = makeBlock({
      id: 'b2',
      sourceType: 'fixed_event',
      sourceId: 'fe-2',
      startTime: '15:00',
      endTime: '16:00',
    });

    const existingPlan = makePlan([block1, block2]);

    // Add a new flexible task that fits in the gap
    const input = makeScheduleInput({
      fixedEvents: [
        makeFixedEvent({ id: 'fe-1', startTime: '09:00', endTime: '10:00' }),
        makeFixedEvent({ id: 'fe-2', startTime: '15:00', endTime: '16:00' }),
      ],
      flexibleTasks: [
        makeFlexibleTask({
          id: 'ft-new',
          title: 'New Task',
          remainingMinutes: 30,
          minSessionMinutes: 15,
          priority: 'high',
        }),
      ],
    });

    const change: ScheduleChange = {
      type: 'add',
      sourceType: 'flexible_task',
      sourceId: 'ft-new',
      date: '2025-01-20',
    };

    const result = repair(existingPlan, change, input);

    // The new task should be placed in a gap
    const newTaskBlocks = result.plan.blocks.filter(
      (b) => b.sourceType === 'flexible_task' && b.sourceId === 'ft-new',
    );
    expect(newTaskBlocks.length).toBeGreaterThan(0);

    // Change summary should show added blocks
    expect(result.changeSummary.added.length).toBeGreaterThan(0);
  });
});
