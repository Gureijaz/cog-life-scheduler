import { describe, it, expect } from 'vitest';
import type { FixedEvent, FlexibleTask, ScheduleBlock, Assignment, PreferenceProfile, TravelRule } from '../types/domain';
import type { ScheduleInput } from '../types/engine';
import {
  timeToMinutes,
  minutesToTime,
  placeHardConstraints,
  computeAndSortByUrgency,
  findAvailableGaps,
  deadlineToMinutes,
  placeDeadlineCriticalItems,
  insertTravelBuffers,
  applyWellbeingConstraints,
  placeRemainingItems,
  generateExplanations,
  computeAtRiskAssignments,
  solve,
} from './solver';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makeLockedBlock(overrides: Partial<ScheduleBlock> = {}): ScheduleBlock {
  return {
    id: 'lb-1',
    planId: 'old-plan',
    sourceType: 'flexible_task',
    sourceId: 'task-1',
    title: 'Locked Study',
    startTime: '14:00',
    endTime: '15:00',
    locationId: null,
    locked: true,
    sortOrder: 0,
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
// Time helpers
// ---------------------------------------------------------------------------

describe('timeToMinutes', () => {
  it('converts 00:00 to 0', () => {
    expect(timeToMinutes('00:00')).toBe(0);
  });

  it('converts 09:30 to 570', () => {
    expect(timeToMinutes('09:30')).toBe(570);
  });

  it('converts 23:59 to 1439', () => {
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  it('throws on invalid format', () => {
    expect(() => timeToMinutes('invalid')).toThrow('Invalid time format');
  });
});

describe('minutesToTime', () => {
  it('converts 0 to 00:00', () => {
    expect(minutesToTime(0)).toBe('00:00');
  });

  it('converts 570 to 09:30', () => {
    expect(minutesToTime(570)).toBe('09:30');
  });

  it('converts 1439 to 23:59', () => {
    expect(minutesToTime(1439)).toBe('23:59');
  });

  it('clamps negative values to 00:00', () => {
    expect(minutesToTime(-10)).toBe('00:00');
  });
});

// ---------------------------------------------------------------------------
// Phase 1 — Place Hard Constraints
// ---------------------------------------------------------------------------

describe('placeHardConstraints', () => {
  it('converts fixed events to schedule blocks', () => {
    const events = [makeFixedEvent()];
    const blocks = placeHardConstraints(events, [], 'plan-1');

    expect(blocks).toHaveLength(1);
    expect(blocks[0].sourceType).toBe('fixed_event');
    expect(blocks[0].sourceId).toBe('fe-1');
    expect(blocks[0].startTime).toBe('09:00');
    expect(blocks[0].endTime).toBe('10:00');
    expect(blocks[0].planId).toBe('plan-1');
  });

  it('carries over locked blocks with updated planId', () => {
    const locked = [makeLockedBlock()];
    const blocks = placeHardConstraints([], locked, 'plan-2');

    expect(blocks).toHaveLength(1);
    expect(blocks[0].locked).toBe(true);
    expect(blocks[0].planId).toBe('plan-2');
    expect(blocks[0].title).toBe('Locked Study');
  });

  it('sorts combined blocks by start time', () => {
    const events = [
      makeFixedEvent({ id: 'fe-late', startTime: '14:00', endTime: '15:00' }),
      makeFixedEvent({ id: 'fe-early', startTime: '08:00', endTime: '09:00' }),
    ];
    const locked = [
      makeLockedBlock({ startTime: '11:00', endTime: '12:00' }),
    ];

    const blocks = placeHardConstraints(events, locked, 'plan-3');

    expect(blocks).toHaveLength(3);
    expect(blocks[0].startTime).toBe('08:00');
    expect(blocks[1].startTime).toBe('11:00');
    expect(blocks[2].startTime).toBe('14:00');
  });

  it('assigns sequential sort orders after sorting', () => {
    const events = [
      makeFixedEvent({ id: 'fe-2', startTime: '12:00', endTime: '13:00' }),
      makeFixedEvent({ id: 'fe-1', startTime: '09:00', endTime: '10:00' }),
    ];

    const blocks = placeHardConstraints(events, [], 'plan-4');

    expect(blocks[0].sortOrder).toBe(0);
    expect(blocks[1].sortOrder).toBe(1);
  });

  it('returns empty array when no events or locked blocks', () => {
    const blocks = placeHardConstraints([], [], 'plan-5');
    expect(blocks).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Phase 2 — Compute Urgency
// ---------------------------------------------------------------------------

describe('computeAndSortByUrgency', () => {
  const now = new Date('2025-01-20T12:00:00Z');

  it('computes urgency scores for assignments', () => {
    const assignments = [makeAssignment()];
    const scored = computeAndSortByUrgency(assignments, now);

    expect(scored).toHaveLength(1);
    expect(scored[0].urgencyScore).toBeGreaterThan(0);
    expect(scored[0].urgencyScore).toBeLessThanOrEqual(1);
    expect(scored[0].assignment.id).toBe('a-1');
  });

  it('sorts assignments by urgency descending', () => {
    const assignments = [
      // Far deadline → low urgency
      makeAssignment({
        id: 'a-low',
        deadline: new Date('2025-02-20T23:59:00Z'),
        estimatedTotalMinutes: 60,
        progressPercent: 0,
      }),
      // Near deadline → high urgency
      makeAssignment({
        id: 'a-high',
        deadline: new Date('2025-01-21T12:00:00Z'),
        estimatedTotalMinutes: 120,
        progressPercent: 0,
      }),
    ];

    const scored = computeAndSortByUrgency(assignments, now);

    expect(scored[0].assignment.id).toBe('a-high');
    expect(scored[1].assignment.id).toBe('a-low');
    expect(scored[0].urgencyScore).toBeGreaterThan(scored[1].urgencyScore);
  });

  it('assigns urgency 0 for fully completed assignments', () => {
    const assignments = [
      makeAssignment({ id: 'a-done', progressPercent: 100 }),
    ];

    const scored = computeAndSortByUrgency(assignments, now);
    expect(scored[0].urgencyScore).toBe(0);
  });

  it('assigns urgency 1 for past-deadline assignments with remaining work', () => {
    const assignments = [
      makeAssignment({
        id: 'a-overdue',
        deadline: new Date('2025-01-19T23:59:00Z'),
        progressPercent: 50,
      }),
    ];

    const scored = computeAndSortByUrgency(assignments, now);
    expect(scored[0].urgencyScore).toBe(1);
  });

  it('returns empty array for no assignments', () => {
    const scored = computeAndSortByUrgency([], now);
    expect(scored).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Phase 3 — Place Deadline-Critical Items
// ---------------------------------------------------------------------------

describe('findAvailableGaps', () => {
  it('returns full waking window when no blocks exist', () => {
    const gaps = findAvailableGaps([], '07:00', '23:00');
    expect(gaps).toEqual([{ startMin: 420, endMin: 1380 }]);
  });

  it('finds gaps between blocks', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({ startTime: '09:00', endTime: '10:00' }),
      makeLockedBlock({ startTime: '12:00', endTime: '13:00' }),
    ];
    const gaps = findAvailableGaps(blocks, '07:00', '23:00');
    expect(gaps).toEqual([
      { startMin: 420, endMin: 540 },   // 07:00 - 09:00
      { startMin: 600, endMin: 720 },   // 10:00 - 12:00
      { startMin: 780, endMin: 1380 },  // 13:00 - 23:00
    ]);
  });

  it('respects sleep time boundary', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({ startTime: '20:00', endTime: '21:00' }),
    ];
    const gaps = findAvailableGaps(blocks, '07:00', '22:00');
    expect(gaps).toEqual([
      { startMin: 420, endMin: 1200 },  // 07:00 - 20:00
      { startMin: 1260, endMin: 1320 }, // 21:00 - 22:00
    ]);
  });

  it('returns no gaps when blocks fill the entire day', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({ startTime: '07:00', endTime: '23:00' }),
    ];
    const gaps = findAvailableGaps(blocks, '07:00', '23:00');
    expect(gaps).toEqual([]);
  });
});

describe('deadlineToMinutes', () => {
  it('returns sleepMin for future deadline dates', () => {
    const deadline = new Date('2025-01-25T23:59:00Z');
    expect(deadlineToMinutes(deadline, '2025-01-20', 1380)).toBe(1380);
  });

  it('returns minutes since midnight for same-day deadline', () => {
    const deadline = new Date('2025-01-20T14:30:00Z');
    expect(deadlineToMinutes(deadline, '2025-01-20', 1380)).toBe(870); // 14*60+30
  });

  it('returns 0 for past deadline dates', () => {
    const deadline = new Date('2025-01-19T23:59:00Z');
    expect(deadlineToMinutes(deadline, '2025-01-20', 1380)).toBe(0);
  });
});

describe('placeDeadlineCriticalItems', () => {
  it('allocates assignment blocks in available gaps', () => {
    const scored = [
      {
        assignment: makeAssignment({
          id: 'a-1',
          remainingMinutes: 60,
          deadline: new Date('2025-01-25T23:59:00Z'),
        }),
        urgencyScore: 0.8,
      },
    ];
    const existingBlocks: ScheduleBlock[] = [
      makeLockedBlock({ startTime: '09:00', endTime: '10:00' }),
    ];

    const { newBlocks, unscheduledItems } = placeDeadlineCriticalItems(
      scored, existingBlocks, 'plan-1', '2025-01-20', '07:00', '23:00',
    );

    expect(newBlocks).toHaveLength(1);
    expect(newBlocks[0].sourceType).toBe('assignment');
    expect(newBlocks[0].sourceId).toBe('a-1');
    expect(newBlocks[0].startTime).toBe('07:00');
    expect(newBlocks[0].endTime).toBe('08:00');
    expect(unscheduledItems).toHaveLength(0);
  });

  it('never places assignment blocks after deadline', () => {
    // Deadline at 11:00 on schedule date, block from 09:00-10:30
    const scored = [
      {
        assignment: makeAssignment({
          id: 'a-1',
          remainingMinutes: 120,
          deadline: new Date('2025-01-20T11:00:00Z'),
        }),
        urgencyScore: 0.9,
      },
    ];
    const existingBlocks: ScheduleBlock[] = [
      makeLockedBlock({ startTime: '09:00', endTime: '10:30' }),
    ];

    const { newBlocks, unscheduledItems } = placeDeadlineCriticalItems(
      scored, existingBlocks, 'plan-1', '2025-01-20', '07:00', '23:00',
    );

    // Should place in 07:00-09:00 gap (120 min available, but only 120 min needed)
    // Gap 1: 07:00-09:00 = 120 min, constrained by deadline 11:00 → 120 min available
    // Gap 2: 10:30-11:00 = 30 min
    for (const block of newBlocks) {
      const endMin = timeToMinutes(block.endTime);
      expect(endMin).toBeLessThanOrEqual(660); // 11:00 = 660 min
    }
  });

  it('schedules higher urgency assignments first', () => {
    const scored = [
      {
        assignment: makeAssignment({
          id: 'a-high',
          title: 'Urgent Essay',
          remainingMinutes: 480,
          deadline: new Date('2025-01-25T23:59:00Z'),
        }),
        urgencyScore: 0.9,
      },
      {
        assignment: makeAssignment({
          id: 'a-low',
          title: 'Low Priority',
          remainingMinutes: 480,
          deadline: new Date('2025-01-25T23:59:00Z'),
        }),
        urgencyScore: 0.2,
      },
    ];

    const { newBlocks } = placeDeadlineCriticalItems(
      scored, [], 'plan-1', '2025-01-20', '07:00', '23:00',
    );

    // High urgency should get the first block (earliest time)
    const highBlocks = newBlocks.filter(b => b.sourceId === 'a-high');
    const lowBlocks = newBlocks.filter(b => b.sourceId === 'a-low');
    expect(highBlocks.length).toBeGreaterThan(0);
    expect(lowBlocks.length).toBeGreaterThan(0);
    expect(timeToMinutes(highBlocks[0].startTime))
      .toBeLessThan(timeToMinutes(lowBlocks[0].startTime));
  });

  it('skips fully completed assignments', () => {
    const scored = [
      {
        assignment: makeAssignment({
          id: 'a-done',
          progressPercent: 100,
          remainingMinutes: 0,
        }),
        urgencyScore: 0,
      },
    ];

    const { newBlocks, unscheduledItems } = placeDeadlineCriticalItems(
      scored, [], 'plan-1', '2025-01-20', '07:00', '23:00',
    );

    expect(newBlocks).toHaveLength(0);
    expect(unscheduledItems).toHaveLength(0);
  });

  it('reports unscheduled items when deadline has passed', () => {
    const scored = [
      {
        assignment: makeAssignment({
          id: 'a-overdue',
          title: 'Overdue Essay',
          remainingMinutes: 60,
          deadline: new Date('2025-01-19T23:59:00Z'),
        }),
        urgencyScore: 1.0,
      },
    ];

    const { newBlocks, unscheduledItems } = placeDeadlineCriticalItems(
      scored, [], 'plan-1', '2025-01-20', '07:00', '23:00',
    );

    expect(newBlocks).toHaveLength(0);
    expect(unscheduledItems).toHaveLength(1);
    expect(unscheduledItems[0].sourceId).toBe('a-overdue');
    expect(unscheduledItems[0].reason).toContain('passed');
  });

  it('reports partial scheduling when not enough time before deadline', () => {
    const scored = [
      {
        assignment: makeAssignment({
          id: 'a-tight',
          title: 'Tight Deadline',
          remainingMinutes: 180,
          deadline: new Date('2025-01-20T09:00:00Z'),
        }),
        urgencyScore: 0.95,
      },
    ];

    const { newBlocks, unscheduledItems } = placeDeadlineCriticalItems(
      scored, [], 'plan-1', '2025-01-20', '07:00', '23:00',
    );

    // Only 120 min available (07:00-09:00), needs 180
    expect(newBlocks).toHaveLength(1);
    expect(newBlocks[0].startTime).toBe('07:00');
    expect(newBlocks[0].endTime).toBe('09:00');
    expect(unscheduledItems).toHaveLength(1);
    expect(unscheduledItems[0].reason).toContain('60');
  });
});

// ---------------------------------------------------------------------------
// Phase 4 — Insert Travel Buffers
// ---------------------------------------------------------------------------

describe('insertTravelBuffers', () => {
  it('inserts travel buffer between blocks at different locations', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({
        id: 'b1',
        title: 'Class',
        startTime: '09:00',
        endTime: '10:00',
        locationId: 'loc-uni',
      }),
      makeLockedBlock({
        id: 'b2',
        title: 'Gym',
        startTime: '11:00',
        endTime: '12:00',
        locationId: 'loc-gym',
      }),
    ];

    const rules: TravelRule[] = [
      { id: 'tr-1', userId: 'user-1', originId: 'loc-uni', destinationId: 'loc-gym', travelMinutes: 20 },
    ];

    const result = insertTravelBuffers(blocks, rules, 15, 'plan-1');

    expect(result).toHaveLength(3);
    const travelBlock = result.find(b => b.sourceType === 'travel_buffer');
    expect(travelBlock).toBeDefined();
    expect(travelBlock!.startTime).toBe('10:00');
    expect(travelBlock!.endTime).toBe('10:20');
    expect(travelBlock!.title).toContain('Travel');
    expect(travelBlock!.sourceId).toBeNull();
  });

  it('uses default commute time when no travel rule exists', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({
        id: 'b1',
        title: 'Home Study',
        startTime: '09:00',
        endTime: '10:00',
        locationId: 'loc-home',
      }),
      makeLockedBlock({
        id: 'b2',
        title: 'Office',
        startTime: '11:00',
        endTime: '12:00',
        locationId: 'loc-office',
      }),
    ];

    const result = insertTravelBuffers(blocks, [], 30, 'plan-1');

    expect(result).toHaveLength(3);
    const travelBlock = result.find(b => b.sourceType === 'travel_buffer');
    expect(travelBlock).toBeDefined();
    expect(travelBlock!.startTime).toBe('10:00');
    expect(travelBlock!.endTime).toBe('10:30');
  });

  it('does not insert buffer when blocks are at the same location', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({
        startTime: '09:00',
        endTime: '10:00',
        locationId: 'loc-uni',
      }),
      makeLockedBlock({
        startTime: '10:00',
        endTime: '11:00',
        locationId: 'loc-uni',
      }),
    ];

    const result = insertTravelBuffers(blocks, [], 15, 'plan-1');
    expect(result).toHaveLength(2);
    expect(result.every(b => b.sourceType !== 'travel_buffer')).toBe(true);
  });

  it('does not insert buffer when locations are null', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({ startTime: '09:00', endTime: '10:00', locationId: null }),
      makeLockedBlock({ startTime: '10:30', endTime: '11:30', locationId: null }),
    ];

    const result = insertTravelBuffers(blocks, [], 15, 'plan-1');
    expect(result).toHaveLength(2);
  });

  it('re-sorts blocks and re-assigns sort orders after insertion', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({
        id: 'b1',
        title: 'A',
        startTime: '09:00',
        endTime: '10:00',
        locationId: 'loc-a',
      }),
      makeLockedBlock({
        id: 'b2',
        title: 'B',
        startTime: '11:00',
        endTime: '12:00',
        locationId: 'loc-b',
      }),
    ];

    const result = insertTravelBuffers(blocks, [], 15, 'plan-1');

    // Verify sort orders are sequential
    for (let i = 0; i < result.length; i++) {
      expect(result[i].sortOrder).toBe(i);
    }

    // Verify chronological order
    for (let i = 1; i < result.length; i++) {
      expect(timeToMinutes(result[i].startTime))
        .toBeGreaterThanOrEqual(timeToMinutes(result[i - 1].startTime));
    }
  });

  it('limits buffer duration to available gap', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({
        id: 'b1',
        title: 'A',
        startTime: '09:00',
        endTime: '10:00',
        locationId: 'loc-a',
      }),
      makeLockedBlock({
        id: 'b2',
        title: 'B',
        startTime: '10:10',
        endTime: '11:00',
        locationId: 'loc-b',
      }),
    ];

    // Travel rule says 30 min, but only 10 min gap
    const rules: TravelRule[] = [
      { id: 'tr-1', userId: 'user-1', originId: 'loc-a', destinationId: 'loc-b', travelMinutes: 30 },
    ];

    const result = insertTravelBuffers(blocks, rules, 15, 'plan-1');
    const travelBlock = result.find(b => b.sourceType === 'travel_buffer');
    expect(travelBlock).toBeDefined();
    // Buffer should be limited to the 10-minute gap
    expect(travelBlock!.startTime).toBe('10:00');
    expect(travelBlock!.endTime).toBe('10:10');
  });
});

// ---------------------------------------------------------------------------
// solve() integration
// ---------------------------------------------------------------------------

describe('solve', () => {
  it('returns a plan with fixed events placed as blocks', () => {
    const input = makeScheduleInput({
      fixedEvents: [
        makeFixedEvent({ id: 'fe-1', startTime: '09:00', endTime: '10:00' }),
        makeFixedEvent({ id: 'fe-2', startTime: '13:00', endTime: '14:00' }),
      ],
    });

    const result = solve(input);

    expect(result.plan.blocks).toHaveLength(2);
    expect(result.plan.blocks[0].sourceType).toBe('fixed_event');
    expect(result.plan.blocks[0].sourceId).toBe('fe-1');
    expect(result.plan.blocks[1].sourceId).toBe('fe-2');
    expect(result.plan.planDate).toBe('2025-01-20');
  });

  it('preserves locked blocks in the plan', () => {
    const locked = makeLockedBlock({ startTime: '11:00', endTime: '12:00' });
    const input = makeScheduleInput({
      fixedEvents: [makeFixedEvent()],
      lockedBlocks: [locked],
    });

    const result = solve(input);

    expect(result.plan.blocks).toHaveLength(2);
    const lockedResult = result.plan.blocks.find((b) => b.locked);
    expect(lockedResult).toBeDefined();
    expect(lockedResult!.startTime).toBe('11:00');
    expect(lockedResult!.endTime).toBe('12:00');
  });

  it('returns empty unscheduledItems for simple input', () => {
    const input = makeScheduleInput();
    const result = solve(input);

    expect(result.unscheduledItems).toHaveLength(0);
  });

  it('generates a valid plan structure', () => {
    const input = makeScheduleInput();
    const result = solve(input);

    expect(result.plan.id).toBeDefined();
    expect(result.plan.userId).toBe('user-1');
    expect(result.plan.version).toBe(1);
    expect(result.plan.generatedAt).toBeInstanceOf(Date);
  });

  it('places assignment blocks in available gaps (Phase 3)', () => {
    const input = makeScheduleInput({
      fixedEvents: [
        makeFixedEvent({ id: 'fe-1', startTime: '09:00', endTime: '10:00' }),
      ],
      assignments: [
        makeAssignment({
          id: 'a-1',
          title: 'Essay',
          remainingMinutes: 60,
          estimatedTotalMinutes: 120,
          progressPercent: 50,
          deadline: new Date('2025-01-25T23:59:00Z'),
        }),
      ],
    });

    const result = solve(input);

    const assignmentBlocks = result.plan.blocks.filter(b => b.sourceType === 'assignment');
    expect(assignmentBlocks.length).toBeGreaterThan(0);
    expect(assignmentBlocks[0].sourceId).toBe('a-1');
    // Should be placed before the fixed event (07:00-08:00)
    expect(assignmentBlocks[0].startTime).toBe('07:00');
    expect(assignmentBlocks[0].endTime).toBe('08:00');
  });

  it('inserts travel buffers between blocks at different locations (Phase 4)', () => {
    const input = makeScheduleInput({
      fixedEvents: [
        makeFixedEvent({
          id: 'fe-1',
          startTime: '09:00',
          endTime: '10:00',
          locationId: 'loc-uni',
        }),
        makeFixedEvent({
          id: 'fe-2',
          startTime: '12:00',
          endTime: '13:00',
          locationId: 'loc-gym',
        }),
      ],
      travelRules: [
        { id: 'tr-1', userId: 'user-1', originId: 'loc-uni', destinationId: 'loc-gym', travelMinutes: 25 },
      ],
    });

    const result = solve(input);

    const travelBlocks = result.plan.blocks.filter(b => b.sourceType === 'travel_buffer');
    expect(travelBlocks.length).toBeGreaterThan(0);
    expect(travelBlocks[0].startTime).toBe('10:00');
    expect(travelBlocks[0].endTime).toBe('10:25');
    expect(travelBlocks[0].sourceId).toBeNull();
  });

  it('reports unscheduled assignments when deadline has passed', () => {
    const input = makeScheduleInput({
      assignments: [
        makeAssignment({
          id: 'a-overdue',
          title: 'Overdue',
          remainingMinutes: 60,
          deadline: new Date('2025-01-19T23:59:00Z'),
        }),
      ],
    });

    const result = solve(input);
    expect(result.unscheduledItems.length).toBeGreaterThan(0);
    expect(result.unscheduledItems[0].sourceId).toBe('a-overdue');
  });
});


// ---------------------------------------------------------------------------
// Phase 5 — Apply Wellbeing Constraints
// ---------------------------------------------------------------------------

describe('applyWellbeingConstraints', () => {
  it('removes blocks entirely within the sleep window', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({ id: 'b1', startTime: '09:00', endTime: '10:00', locked: false }),
      makeLockedBlock({ id: 'b2', startTime: '23:30', endTime: '23:59', locked: false }),
    ];

    const result = applyWellbeingConstraints(blocks, '07:00', '23:00', 90, 5, 'plan-1');

    expect(result).toHaveLength(1);
    expect(result[0].startTime).toBe('09:00');
  });

  it('removes blocks before wake time', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({ id: 'b1', startTime: '05:00', endTime: '06:00', locked: false }),
      makeLockedBlock({ id: 'b2', startTime: '09:00', endTime: '10:00', locked: false }),
    ];

    const result = applyWellbeingConstraints(blocks, '07:00', '23:00', 90, 5, 'plan-1');

    expect(result).toHaveLength(1);
    expect(result[0].startTime).toBe('09:00');
  });

  it('trims blocks that partially overlap the sleep window', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({ id: 'b1', startTime: '22:00', endTime: '23:30', locked: false }),
    ];

    const result = applyWellbeingConstraints(blocks, '07:00', '23:00', 90, 5, 'plan-1');

    expect(result).toHaveLength(1);
    expect(result[0].startTime).toBe('22:00');
    expect(result[0].endTime).toBe('23:00');
  });

  it('splits blocks exceeding maxDeepWorkMinutes', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({
        id: 'b1',
        startTime: '09:00',
        endTime: '12:00', // 180 min
        locked: false,
        sourceType: 'assignment',
      }),
    ];

    const result = applyWellbeingConstraints(blocks, '07:00', '23:00', 90, 0, 'plan-1');

    expect(result).toHaveLength(2);
    expect(result[0].startTime).toBe('09:00');
    expect(result[0].endTime).toBe('10:30'); // 90 min
    expect(result[1].startTime).toBe('10:30');
    expect(result[1].endTime).toBe('12:00'); // 90 min
  });

  it('does not split fixed events or locked blocks', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({
        id: 'b1',
        startTime: '09:00',
        endTime: '12:00', // 180 min
        locked: true,
      }),
      makeLockedBlock({
        id: 'b2',
        startTime: '13:00',
        endTime: '16:00', // 180 min
        locked: false,
        sourceType: 'fixed_event',
      }),
    ];

    const result = applyWellbeingConstraints(blocks, '07:00', '23:00', 90, 0, 'plan-1');

    expect(result).toHaveLength(2);
    expect(result[0].endTime).toBe('12:00');
    expect(result[1].endTime).toBe('16:00');
  });

  it('enforces minimum buffer between non-travel blocks', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({ id: 'b1', startTime: '09:00', endTime: '10:00', locked: false }),
      makeLockedBlock({ id: 'b2', startTime: '10:02', endTime: '11:00', locked: false }),
    ];

    const result = applyWellbeingConstraints(blocks, '07:00', '23:00', 90, 5, 'plan-1');

    expect(result).toHaveLength(2);
    const gap = timeToMinutes(result[1].startTime) - timeToMinutes(result[0].endTime);
    expect(gap).toBeGreaterThanOrEqual(5);
  });

  it('removes block if buffer enforcement makes it zero duration', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({ id: 'b1', startTime: '09:00', endTime: '10:00', locked: false }),
      makeLockedBlock({ id: 'b2', startTime: '10:01', endTime: '10:05', locked: false }),
    ];

    // 5 min buffer needed, but block b2 is only 4 min long and starts 1 min after b1
    // newStart = 10:05, but endTime is 10:05 → zero duration → removed
    const result = applyWellbeingConstraints(blocks, '07:00', '23:00', 90, 5, 'plan-1');

    expect(result).toHaveLength(1);
    expect(result[0].startTime).toBe('09:00');
  });

  it('does not enforce buffer for travel blocks', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({ id: 'b1', startTime: '09:00', endTime: '10:00', locked: false }),
      makeLockedBlock({ id: 'travel', startTime: '10:00', endTime: '10:15', locked: false, sourceType: 'travel_buffer' }),
      makeLockedBlock({ id: 'b2', startTime: '10:15', endTime: '11:00', locked: false }),
    ];

    const result = applyWellbeingConstraints(blocks, '07:00', '23:00', 90, 10, 'plan-1');

    // Travel block should remain adjacent without buffer enforcement
    expect(result).toHaveLength(3);
    const travelBlock = result.find(b => b.sourceType === 'travel_buffer');
    expect(travelBlock).toBeDefined();
    expect(travelBlock!.startTime).toBe('10:00');
  });

  it('reassigns sort orders after processing', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({ id: 'b2', startTime: '14:00', endTime: '15:00', locked: false }),
      makeLockedBlock({ id: 'b1', startTime: '09:00', endTime: '10:00', locked: false }),
    ];

    const result = applyWellbeingConstraints(blocks, '07:00', '23:00', 90, 5, 'plan-1');

    for (let i = 0; i < result.length; i++) {
      expect(result[i].sortOrder).toBe(i);
    }
    expect(timeToMinutes(result[0].startTime)).toBeLessThan(timeToMinutes(result[1].startTime));
  });
});

// ---------------------------------------------------------------------------
// Phase 6 — Place Remaining Items
// ---------------------------------------------------------------------------

describe('placeRemainingItems', () => {
  it('places a flexible task in an available gap', () => {
    const tasks = [makeFlexibleTask({ id: 'ft-1', remainingMinutes: 60, minSessionMinutes: 15 })];
    const existingBlocks: ScheduleBlock[] = [
      makeLockedBlock({ startTime: '09:00', endTime: '10:00' }),
    ];

    const { newBlocks, unscheduledItems } = placeRemainingItems(
      tasks, existingBlocks, 'plan-1', '07:00', '23:00', 5,
    );

    expect(newBlocks).toHaveLength(1);
    expect(newBlocks[0].sourceType).toBe('flexible_task');
    expect(newBlocks[0].sourceId).toBe('ft-1');
    expect(newBlocks[0].startTime).toBe('07:00');
    expect(newBlocks[0].endTime).toBe('08:00');
    expect(unscheduledItems).toHaveLength(0);
  });

  it('places higher-priority tasks first', () => {
    const tasks = [
      makeFlexibleTask({ id: 'ft-low', priority: 'low', remainingMinutes: 480, minSessionMinutes: 15 }),
      makeFlexibleTask({ id: 'ft-critical', priority: 'critical', remainingMinutes: 480, minSessionMinutes: 15 }),
    ];

    const { newBlocks } = placeRemainingItems(
      tasks, [], 'plan-1', '07:00', '23:00', 0,
    );

    const criticalBlocks = newBlocks.filter(b => b.sourceId === 'ft-critical');
    const lowBlocks = newBlocks.filter(b => b.sourceId === 'ft-low');
    expect(criticalBlocks.length).toBeGreaterThan(0);
    expect(lowBlocks.length).toBeGreaterThan(0);
    expect(timeToMinutes(criticalBlocks[0].startTime))
      .toBeLessThan(timeToMinutes(lowBlocks[0].startTime));
  });

  it('respects minSessionMinutes — skips gaps too small', () => {
    const tasks = [makeFlexibleTask({ id: 'ft-1', remainingMinutes: 60, minSessionMinutes: 30 })];
    const existingBlocks: ScheduleBlock[] = [
      makeLockedBlock({ startTime: '07:00', endTime: '07:20' }),
      makeLockedBlock({ startTime: '07:25', endTime: '08:00' }), // 5 min gap — too small
      // Gap from 08:00 to 23:00 is large enough
    ];

    const { newBlocks } = placeRemainingItems(
      tasks, existingBlocks, 'plan-1', '07:00', '23:00', 0,
    );

    expect(newBlocks).toHaveLength(1);
    expect(newBlocks[0].startTime).toBe('08:00');
    expect(newBlocks[0].endTime).toBe('09:00');
  });

  it('splits tasks across multiple blocks when needed', () => {
    const tasks = [makeFlexibleTask({ id: 'ft-1', remainingMinutes: 120, minSessionMinutes: 30 })];
    const existingBlocks: ScheduleBlock[] = [
      makeLockedBlock({ startTime: '08:00', endTime: '09:00' }),
      makeLockedBlock({ startTime: '10:00', endTime: '11:00' }),
    ];

    const { newBlocks, unscheduledItems } = placeRemainingItems(
      tasks, existingBlocks, 'plan-1', '07:00', '23:00', 0,
    );

    // Should split: 07:00-08:00 (60 min) + 09:00-10:00 (60 min)
    expect(newBlocks).toHaveLength(2);
    expect(newBlocks[0].startTime).toBe('07:00');
    expect(newBlocks[0].endTime).toBe('08:00');
    expect(newBlocks[1].startTime).toBe('09:00');
    expect(newBlocks[1].endTime).toBe('10:00');
    expect(unscheduledItems).toHaveLength(0);
  });

  it('reports unscheduled tasks when not enough time', () => {
    const tasks = [makeFlexibleTask({ id: 'ft-1', remainingMinutes: 60, minSessionMinutes: 15 })];
    const existingBlocks: ScheduleBlock[] = [
      makeLockedBlock({ startTime: '07:00', endTime: '23:00' }), // fills entire day
    ];

    const { newBlocks, unscheduledItems } = placeRemainingItems(
      tasks, existingBlocks, 'plan-1', '07:00', '23:00', 0,
    );

    expect(newBlocks).toHaveLength(0);
    expect(unscheduledItems).toHaveLength(1);
    expect(unscheduledItems[0].sourceId).toBe('ft-1');
    expect(unscheduledItems[0].sourceType).toBe('flexible_task');
  });

  it('skips tasks with zero remaining minutes', () => {
    const tasks = [makeFlexibleTask({ id: 'ft-done', remainingMinutes: 0 })];

    const { newBlocks, unscheduledItems } = placeRemainingItems(
      tasks, [], 'plan-1', '07:00', '23:00', 0,
    );

    expect(newBlocks).toHaveLength(0);
    expect(unscheduledItems).toHaveLength(0);
  });

  it('tracks remaining minutes across multiple tasks', () => {
    const tasks = [
      makeFlexibleTask({ id: 'ft-1', priority: 'high', remainingMinutes: 60, minSessionMinutes: 15 }),
      makeFlexibleTask({ id: 'ft-2', priority: 'medium', remainingMinutes: 60, minSessionMinutes: 15 }),
    ];

    const { newBlocks } = placeRemainingItems(
      tasks, [], 'plan-1', '07:00', '23:00', 0,
    );

    const ft1Blocks = newBlocks.filter(b => b.sourceId === 'ft-1');
    const ft2Blocks = newBlocks.filter(b => b.sourceId === 'ft-2');
    expect(ft1Blocks).toHaveLength(1);
    expect(ft2Blocks).toHaveLength(1);
    // ft-1 (high) should come before ft-2 (medium)
    expect(timeToMinutes(ft1Blocks[0].startTime))
      .toBeLessThan(timeToMinutes(ft2Blocks[0].startTime));
  });
});

// ---------------------------------------------------------------------------
// solve() integration — Phase 5 & 6
// ---------------------------------------------------------------------------

describe('solve — Phase 5 & 6 integration', () => {
  it('removes blocks in sleep window during solve', () => {
    // Create a scenario where Phase 3 might place a block near sleep time
    // and Phase 5 should trim it
    const input = makeScheduleInput({
      preferences: makePreferences({ wakeTime: '07:00', sleepTime: '22:00' }),
      fixedEvents: [
        makeFixedEvent({ id: 'fe-1', startTime: '21:00', endTime: '22:30' }),
      ],
    });

    const result = solve(input);

    // The fixed event extends past sleep time — should be trimmed to 22:00
    const feBlock = result.plan.blocks.find(b => b.sourceId === 'fe-1');
    expect(feBlock).toBeDefined();
    expect(feBlock!.endTime).toBe('22:00');
  });

  it('places flexible tasks in available gaps', () => {
    const input = makeScheduleInput({
      fixedEvents: [
        makeFixedEvent({ id: 'fe-1', startTime: '09:00', endTime: '10:00' }),
      ],
      flexibleTasks: [
        makeFlexibleTask({ id: 'ft-1', title: 'Workout', remainingMinutes: 60, minSessionMinutes: 30, priority: 'high' }),
      ],
    });

    const result = solve(input);

    const taskBlocks = result.plan.blocks.filter(b => b.sourceType === 'flexible_task');
    expect(taskBlocks.length).toBeGreaterThan(0);
    expect(taskBlocks[0].sourceId).toBe('ft-1');
  });

  it('reports unscheduled flexible tasks when day is full', () => {
    const input = makeScheduleInput({
      preferences: makePreferences({ wakeTime: '09:00', sleepTime: '10:00' }),
      fixedEvents: [
        makeFixedEvent({ id: 'fe-1', startTime: '09:00', endTime: '10:00' }),
      ],
      flexibleTasks: [
        makeFlexibleTask({ id: 'ft-1', remainingMinutes: 60, minSessionMinutes: 15 }),
      ],
    });

    const result = solve(input);

    expect(result.unscheduledItems.some(u => u.sourceId === 'ft-1')).toBe(true);
  });

  it('schedules critical tasks before low-priority tasks', () => {
    const input = makeScheduleInput({
      flexibleTasks: [
        makeFlexibleTask({ id: 'ft-low', priority: 'low', remainingMinutes: 120, minSessionMinutes: 15 }),
        makeFlexibleTask({ id: 'ft-crit', priority: 'critical', remainingMinutes: 120, minSessionMinutes: 15 }),
      ],
    });

    const result = solve(input);

    const critBlocks = result.plan.blocks.filter(b => b.sourceId === 'ft-crit');
    const lowBlocks = result.plan.blocks.filter(b => b.sourceId === 'ft-low');
    expect(critBlocks.length).toBeGreaterThan(0);
    expect(lowBlocks.length).toBeGreaterThan(0);
    expect(timeToMinutes(critBlocks[0].startTime))
      .toBeLessThan(timeToMinutes(lowBlocks[0].startTime));
  });

  it('splits deep work blocks that exceed maxDeepWorkMinutes', () => {
    const input = makeScheduleInput({
      preferences: makePreferences({ maxDeepWorkMinutes: 60 }),
      assignments: [
        makeAssignment({
          id: 'a-1',
          remainingMinutes: 120,
          deadline: new Date('2025-01-25T23:59:00Z'),
        }),
      ],
    });

    const result = solve(input);

    const assignmentBlocks = result.plan.blocks.filter(b => b.sourceId === 'a-1');
    // Each block should be at most 60 minutes
    for (const block of assignmentBlocks) {
      const duration = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
      expect(duration).toBeLessThanOrEqual(60);
    }
    expect(assignmentBlocks.length).toBeGreaterThanOrEqual(2);
  });
});


// ---------------------------------------------------------------------------
// Phase 7 — Generate Explanations
// ---------------------------------------------------------------------------

describe('generateExplanations', () => {
  it('generates an explanation for every block', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({ id: 'b1', sourceType: 'fixed_event', sourceId: 'fe-1', startTime: '09:00', endTime: '10:00', locked: false }),
      makeLockedBlock({ id: 'b2', sourceType: 'assignment', sourceId: 'a-1', startTime: '10:00', endTime: '11:00', locked: false }),
      makeLockedBlock({ id: 'b3', sourceType: 'flexible_task', sourceId: 'ft-1', startTime: '11:00', endTime: '12:00', locked: false }),
    ];

    const input = makeScheduleInput({
      fixedEvents: [makeFixedEvent({ id: 'fe-1' })],
      assignments: [makeAssignment({ id: 'a-1' })],
      flexibleTasks: [makeFlexibleTask({ id: 'ft-1' })],
    });

    const explanations = generateExplanations(blocks, input);

    expect(explanations.size).toBe(3);
    expect(explanations.has('b1')).toBe(true);
    expect(explanations.has('b2')).toBe(true);
    expect(explanations.has('b3')).toBe(true);
  });

  it('references Fixed_Event hard constraint for fixed events', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({ id: 'b1', sourceType: 'fixed_event', sourceId: 'fe-1', startTime: '09:00', endTime: '10:00', locked: false }),
    ];

    const input = makeScheduleInput({
      fixedEvents: [makeFixedEvent({ id: 'fe-1', category: 'class' })],
    });

    const explanations = generateExplanations(blocks, input);
    const exp = explanations.get('b1')!;

    expect(exp.explanationText).toContain('hard constraint');
    expect(exp.explanationText).toContain('09:00');
    expect(exp.explanationText).toContain('10:00');
    expect(exp.referencedConstraints).toContain('Fixed_Event hard constraint');
  });

  it('references Assignment deadline proximity for assignments', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({ id: 'b1', sourceType: 'assignment', sourceId: 'a-1', startTime: '07:00', endTime: '08:00', locked: false }),
    ];

    const input = makeScheduleInput({
      assignments: [makeAssignment({ id: 'a-1', title: 'Essay', deadline: new Date('2025-01-25T23:59:00Z') })],
    });

    const explanations = generateExplanations(blocks, input);
    const exp = explanations.get('b1')!;

    expect(exp.explanationText).toContain('Essay');
    expect(exp.explanationText).toContain('urgency score');
    expect(exp.referencedConstraints).toContain('Assignment deadline proximity');
  });

  it('references priority level for flexible tasks', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({ id: 'b1', sourceType: 'flexible_task', sourceId: 'ft-1', startTime: '07:00', endTime: '08:00', locked: false }),
    ];

    const input = makeScheduleInput({
      flexibleTasks: [makeFlexibleTask({ id: 'ft-1', title: 'Study', priority: 'high' })],
    });

    const explanations = generateExplanations(blocks, input);
    const exp = explanations.get('b1')!;

    expect(exp.explanationText).toContain('Study');
    expect(exp.explanationText).toContain('high');
    expect(exp.referencedConstraints).toContain('Priority level: high');
  });

  it('references Travel_Rule for travel buffers with a matching rule', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({ id: 'b1', sourceType: 'fixed_event', sourceId: 'fe-1', title: 'Class', startTime: '09:00', endTime: '10:00', locationId: 'loc-uni', locked: false }),
      makeLockedBlock({ id: 'travel-1', sourceType: 'travel_buffer', sourceId: null, title: 'Travel', startTime: '10:00', endTime: '10:20', locationId: null, locked: false }),
      makeLockedBlock({ id: 'b2', sourceType: 'fixed_event', sourceId: 'fe-2', title: 'Gym', startTime: '10:20', endTime: '11:00', locationId: 'loc-gym', locked: false }),
    ];

    const input = makeScheduleInput({
      fixedEvents: [
        makeFixedEvent({ id: 'fe-1', locationId: 'loc-uni' }),
        makeFixedEvent({ id: 'fe-2', locationId: 'loc-gym' }),
      ],
      travelRules: [
        { id: 'tr-1', userId: 'user-1', originId: 'loc-uni', destinationId: 'loc-gym', travelMinutes: 20 },
      ],
    });

    const explanations = generateExplanations(blocks, input);
    const exp = explanations.get('travel-1')!;

    expect(exp.explanationText).toContain('Travel_Rule');
    expect(exp.explanationText).toContain('20');
    expect(exp.referencedConstraints.some(c => c.includes('Travel_Rule'))).toBe(true);
  });

  it('references default commute time for travel buffers without a rule', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({ id: 'b1', sourceType: 'fixed_event', sourceId: 'fe-1', title: 'Class', startTime: '09:00', endTime: '10:00', locationId: 'loc-uni', locked: false }),
      makeLockedBlock({ id: 'travel-1', sourceType: 'travel_buffer', sourceId: null, title: 'Travel', startTime: '10:00', endTime: '10:15', locationId: null, locked: false }),
      makeLockedBlock({ id: 'b2', sourceType: 'fixed_event', sourceId: 'fe-2', title: 'Gym', startTime: '10:15', endTime: '11:00', locationId: 'loc-gym', locked: false }),
    ];

    const input = makeScheduleInput({
      fixedEvents: [
        makeFixedEvent({ id: 'fe-1', locationId: 'loc-uni' }),
        makeFixedEvent({ id: 'fe-2', locationId: 'loc-gym' }),
      ],
    });

    const explanations = generateExplanations(blocks, input);
    const exp = explanations.get('travel-1')!;

    expect(exp.explanationText).toContain('default commute time');
    expect(exp.referencedConstraints).toContain('Default commute time');
  });

  it('notes suboptimal placement when flexible task is outside preferred window', () => {
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({ id: 'b1', sourceType: 'flexible_task', sourceId: 'ft-1', startTime: '07:00', endTime: '08:00', locked: false }),
    ];

    const input = makeScheduleInput({
      flexibleTasks: [makeFlexibleTask({
        id: 'ft-1',
        title: 'Study',
        priority: 'medium',
        preferredWindow: { start: '14:00', end: '16:00' },
      })],
    });

    const explanations = generateExplanations(blocks, input);
    const exp = explanations.get('b1')!;

    expect(exp.explanationText).toContain('unavailable');
    expect(exp.referencedConstraints.some(c => c.includes('suboptimal'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// At-Risk Assignment Computation
// ---------------------------------------------------------------------------

describe('computeAtRiskAssignments', () => {
  it('reports an assignment as at-risk when available time is insufficient', () => {
    // Day is almost full, assignment needs more time than available
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({ startTime: '07:00', endTime: '22:00' }),
    ];

    const assignments = [
      makeAssignment({
        id: 'a-1',
        title: 'Big Essay',
        remainingMinutes: 120,
        deadline: new Date('2025-01-20T23:00:00Z'),
      }),
    ];

    const result = computeAtRiskAssignments(assignments, blocks, '2025-01-20', '07:00', '23:00');

    expect(result).toHaveLength(1);
    expect(result[0].assignmentId).toBe('a-1');
    expect(result[0].shortfallMinutes).toBe(60); // 120 needed, 60 available (22:00-23:00)
    expect(result[0].remainingMinutes).toBe(120);
    expect(result[0].availableMinutes).toBe(60);
  });

  it('does not report assignments with sufficient available time', () => {
    const blocks: ScheduleBlock[] = [];

    const assignments = [
      makeAssignment({
        id: 'a-1',
        remainingMinutes: 60,
        deadline: new Date('2025-01-25T23:59:00Z'),
      }),
    ];

    const result = computeAtRiskAssignments(assignments, blocks, '2025-01-20', '07:00', '23:00');

    expect(result).toHaveLength(0);
  });

  it('skips fully completed assignments', () => {
    const assignments = [
      makeAssignment({ id: 'a-done', progressPercent: 100, remainingMinutes: 0 }),
    ];

    const result = computeAtRiskAssignments(assignments, [], '2025-01-20', '07:00', '23:00');

    expect(result).toHaveLength(0);
  });

  it('computes correct shortfall for same-day deadline', () => {
    // Deadline at 10:00, only 07:00-09:00 gap available (120 min), needs 180
    const blocks: ScheduleBlock[] = [
      makeLockedBlock({ startTime: '09:00', endTime: '10:00' }),
    ];

    const assignments = [
      makeAssignment({
        id: 'a-tight',
        title: 'Tight',
        remainingMinutes: 180,
        deadline: new Date('2025-01-20T10:00:00Z'),
      }),
    ];

    const result = computeAtRiskAssignments(assignments, blocks, '2025-01-20', '07:00', '23:00');

    expect(result).toHaveLength(1);
    expect(result[0].shortfallMinutes).toBe(60); // 180 needed, 120 available (07:00-09:00)
  });
});

// ---------------------------------------------------------------------------
// solve() integration — Phase 7
// ---------------------------------------------------------------------------

describe('solve — Phase 7 integration', () => {
  it('generates explanations for every block in the plan', () => {
    const input = makeScheduleInput({
      fixedEvents: [
        makeFixedEvent({ id: 'fe-1', startTime: '09:00', endTime: '10:00' }),
      ],
      assignments: [
        makeAssignment({
          id: 'a-1',
          remainingMinutes: 60,
          deadline: new Date('2025-01-25T23:59:00Z'),
        }),
      ],
      flexibleTasks: [
        makeFlexibleTask({ id: 'ft-1', remainingMinutes: 30, minSessionMinutes: 15 }),
      ],
    });

    const result = solve(input);

    // Every block should have an explanation
    for (const block of result.plan.blocks) {
      expect(result.explanations.has(block.id)).toBe(true);
      const exp = result.explanations.get(block.id)!;
      expect(exp.explanationText.length).toBeGreaterThan(0);
      expect(exp.referencedConstraints.length).toBeGreaterThan(0);
      expect(exp.blockId).toBe(block.id);
    }
  });

  it('includes atRiskAssignments in the result', () => {
    const input = makeScheduleInput({
      preferences: makePreferences({ wakeTime: '09:00', sleepTime: '10:00' }),
      fixedEvents: [
        makeFixedEvent({ id: 'fe-1', startTime: '09:00', endTime: '10:00' }),
      ],
      assignments: [
        makeAssignment({
          id: 'a-1',
          title: 'Big Essay',
          remainingMinutes: 120,
          deadline: new Date('2025-01-20T23:00:00Z'),
        }),
      ],
    });

    const result = solve(input);

    expect(result.atRiskAssignments.length).toBeGreaterThan(0);
    expect(result.atRiskAssignments[0].assignmentId).toBe('a-1');
    expect(result.atRiskAssignments[0].shortfallMinutes).toBeGreaterThan(0);
  });

  it('returns empty atRiskAssignments when all assignments fit', () => {
    const input = makeScheduleInput({
      assignments: [
        makeAssignment({
          id: 'a-1',
          remainingMinutes: 60,
          deadline: new Date('2025-01-25T23:59:00Z'),
        }),
      ],
    });

    const result = solve(input);

    expect(result.atRiskAssignments).toHaveLength(0);
  });
});
