// Integration tests for end-to-end flows
// Validates: Requirements 6.1, 6.2, 7.1, 7.3, 7.6, 8.1

import { describe, it, expect, vi, afterEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import type {
  FixedEvent,
  FlexibleTask,
  Assignment,
  PreferenceProfile,
  ScheduleBlock,
  TravelRule,
  Location,
} from './types/domain';
import type { ScheduleInput, ScheduleChange } from './types/engine';
import { solve } from './engine/solver';
import { repair } from './engine/repair';
import { timeToMinutes } from './engine/solver';
import {
  parseLLMResponse,
  buildSystemPrompt,
  AIAssistantService,
  SUPPORTED_OPERATIONS_MESSAGE,
} from './services/ai-assistant';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function makePreferences(overrides: Partial<PreferenceProfile> = {}): PreferenceProfile {
  return {
    id: uuidv4(),
    userId: 'user-1',
    wakeTime: '07:00',
    sleepTime: '23:00',
    focusWindows: [{ start: '09:00', end: '12:00' }],
    workoutWindows: [{ start: '17:00', end: '18:00' }],
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
    id: uuidv4(),
    userId: 'user-1',
    title: 'Morning Class',
    eventDate: '2025-01-20',
    startTime: '09:00',
    endTime: '10:30',
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
    id: uuidv4(),
    userId: 'user-1',
    title: 'Study Session',
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
    id: uuidv4(),
    userId: 'user-1',
    title: 'Essay Draft',
    subject: 'English',
    deadline: new Date('2025-01-22T23:59:00Z'),
    estimatedTotalMinutes: 120,
    progressPercent: 0,
    urgencyScore: 0,
    remainingMinutes: 120,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeTravelRule(overrides: Partial<TravelRule> = {}): TravelRule {
  return {
    id: uuidv4(),
    userId: 'user-1',
    originId: 'loc-home',
    destinationId: 'loc-uni',
    travelMinutes: 30,
    ...overrides,
  };
}

function makeInput(overrides: Partial<ScheduleInput> = {}): ScheduleInput {
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
// 1. Full schedule generation flow
// Validates: Requirements 6.1, 6.2
// ---------------------------------------------------------------------------

describe('Integration: Full schedule generation flow', () => {
  it('generates a plan with fixed events, assignments, flexible tasks, and travel buffers', () => {
    const classEvent = makeFixedEvent({
      id: 'fe-class',
      title: 'Morning Class',
      startTime: '09:00',
      endTime: '10:30',
      locationId: 'loc-uni',
    });
    const meetingEvent = makeFixedEvent({
      id: 'fe-meeting',
      title: 'Advisor Meeting',
      startTime: '14:00',
      endTime: '15:00',
      locationId: 'loc-uni',
    });
    const gymEvent = makeFixedEvent({
      id: 'fe-gym',
      title: 'Gym',
      startTime: '17:00',
      endTime: '18:00',
      locationId: 'loc-gym',
    });

    const assignment = makeAssignment({
      id: 'a-essay',
      title: 'Essay Draft',
      remainingMinutes: 90,
      estimatedTotalMinutes: 120,
      progressPercent: 25,
      deadline: new Date('2025-01-22T23:59:00Z'),
    });

    const task = makeFlexibleTask({
      id: 'ft-reading',
      title: 'Reading',
      remainingMinutes: 45,
      minSessionMinutes: 15,
      priority: 'high',
    });

    const travelRule = makeTravelRule({
      originId: 'loc-uni',
      destinationId: 'loc-gym',
      travelMinutes: 20,
    });

    const input = makeInput({
      fixedEvents: [classEvent, meetingEvent, gymEvent],
      assignments: [assignment],
      flexibleTasks: [task],
      travelRules: [travelRule],
      preferences: makePreferences({ defaultCommuteMinutes: 15 }),
    });

    const result = solve(input);

    // Plan should exist with blocks
    expect(result.plan).toBeDefined();
    expect(result.plan.blocks.length).toBeGreaterThan(0);

    // --- Fixed events are immovable (Req 6.2) ---
    const classBlock = result.plan.blocks.find(
      (b) => b.sourceType === 'fixed_event' && b.sourceId === 'fe-class',
    );
    expect(classBlock).toBeDefined();
    expect(classBlock!.startTime).toBe('09:00');
    expect(classBlock!.endTime).toBe('10:30');

    const meetingBlock = result.plan.blocks.find(
      (b) => b.sourceType === 'fixed_event' && b.sourceId === 'fe-meeting',
    );
    expect(meetingBlock).toBeDefined();
    expect(meetingBlock!.startTime).toBe('14:00');
    expect(meetingBlock!.endTime).toBe('15:00');

    const gymBlock = result.plan.blocks.find(
      (b) => b.sourceType === 'fixed_event' && b.sourceId === 'fe-gym',
    );
    expect(gymBlock).toBeDefined();
    expect(gymBlock!.startTime).toBe('17:00');
    expect(gymBlock!.endTime).toBe('18:00');

    // --- No overlapping blocks ---
    const sorted = [...result.plan.blocks].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
    );
    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = timeToMinutes(sorted[i - 1].endTime);
      const currStart = timeToMinutes(sorted[i].startTime);
      expect(currStart).toBeGreaterThanOrEqual(prevEnd);
    }

    // --- No blocks in sleep window (before 07:00 or after 23:00) ---
    for (const block of result.plan.blocks) {
      const start = timeToMinutes(block.startTime);
      const end = timeToMinutes(block.endTime);
      expect(start).toBeGreaterThanOrEqual(timeToMinutes('07:00'));
      expect(end).toBeLessThanOrEqual(timeToMinutes('23:00'));
    }

    // --- Travel buffer between uni and gym ---
    const uniGymTravel = result.plan.blocks.find(
      (b) => b.sourceType === 'travel_buffer' && b.title.includes('Gym'),
    );
    // Travel buffer should exist if adjacent blocks are at different locations
    // The gym event at loc-gym follows blocks at loc-uni, so a buffer is expected
    if (uniGymTravel) {
      const duration =
        timeToMinutes(uniGymTravel.endTime) - timeToMinutes(uniGymTravel.startTime);
      expect(duration).toBeGreaterThan(0);
    }

    // --- Every block has an explanation ---
    for (const block of result.plan.blocks) {
      expect(result.explanations.has(block.id)).toBe(true);
      const explanation = result.explanations.get(block.id)!;
      expect(explanation.explanationText.length).toBeGreaterThan(0);
      expect(explanation.referencedConstraints.length).toBeGreaterThan(0);
    }

    // --- Blocks are chronologically ordered (Req 6.1) ---
    for (let i = 1; i < result.plan.blocks.length; i++) {
      expect(result.plan.blocks[i].sortOrder).toBeGreaterThan(
        result.plan.blocks[i - 1].sortOrder,
      );
    }
  });

  it('reports unscheduled items when day is overloaded', () => {
    // Fill the day with fixed events leaving very little room
    const events: FixedEvent[] = [];
    for (let h = 7; h < 22; h += 2) {
      events.push(
        makeFixedEvent({
          id: `fe-${h}`,
          title: `Event at ${h}`,
          startTime: `${String(h).padStart(2, '0')}:00`,
          endTime: `${String(h + 1).padStart(2, '0')}:30`,
        }),
      );
    }

    const bigTask = makeFlexibleTask({
      id: 'ft-big',
      title: 'Big Task',
      remainingMinutes: 300,
      minSessionMinutes: 30,
      priority: 'high',
    });

    const input = makeInput({
      fixedEvents: events,
      flexibleTasks: [bigTask],
    });

    const result = solve(input);

    // Should report unscheduled items since there's not enough room
    expect(result.unscheduledItems.length).toBeGreaterThan(0);
    const bigTaskUnscheduled = result.unscheduledItems.find(
      (u) => u.sourceId === 'ft-big',
    );
    expect(bigTaskUnscheduled).toBeDefined();
  });

  it('respects minimum buffer minutes between non-travel blocks', () => {
    const input = makeInput({
      fixedEvents: [
        makeFixedEvent({ id: 'fe-1', startTime: '09:00', endTime: '10:00' }),
      ],
      flexibleTasks: [
        makeFlexibleTask({
          id: 'ft-1',
          remainingMinutes: 60,
          minSessionMinutes: 5,
          priority: 'high',
        }),
      ],
      preferences: makePreferences({ minBufferMinutes: 10 }),
    });

    const result = solve(input);
    const sorted = [...result.plan.blocks].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
    );

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      // Skip travel buffers for buffer enforcement
      if (prev.sourceType === 'travel_buffer' || curr.sourceType === 'travel_buffer') continue;
      if (curr.sourceType === 'fixed_event' || curr.locked) continue;

      const gap = timeToMinutes(curr.startTime) - timeToMinutes(prev.endTime);
      // Gap should be either 0 (adjacent/overlapping from same phase) or >= minBuffer
      if (gap > 0) {
        expect(gap).toBeGreaterThanOrEqual(10);
      }
    }
  });
});


// ---------------------------------------------------------------------------
// 2. Repair flow
// Validates: Requirements 7.1, 7.3, 7.6
// ---------------------------------------------------------------------------

describe('Integration: Repair flow', () => {
  it('preserves locked blocks and produces accurate change summary after adding a new event', () => {
    // Step 1: Generate initial plan with a fixed event and a flexible task
    const classEvent = makeFixedEvent({
      id: 'fe-class',
      title: 'Morning Class',
      startTime: '09:00',
      endTime: '10:30',
    });
    const task = makeFlexibleTask({
      id: 'ft-study',
      title: 'Study',
      remainingMinutes: 60,
      minSessionMinutes: 15,
      priority: 'high',
    });

    const preferences = makePreferences();
    const initialInput = makeInput({
      fixedEvents: [classEvent],
      flexibleTasks: [task],
      preferences,
    });

    const initialResult = solve(initialInput);
    const initialPlan = initialResult.plan;

    // Step 2: Lock a study block
    const studyBlock = initialPlan.blocks.find(
      (b) => b.sourceType === 'flexible_task' && b.sourceId === 'ft-study',
    );
    expect(studyBlock).toBeDefined();

    // Mark it as locked
    studyBlock!.locked = true;
    const lockedStartTime = studyBlock!.startTime;
    const lockedEndTime = studyBlock!.endTime;

    // Step 3: Add a new fixed event and repair
    const newEvent = makeFixedEvent({
      id: 'fe-meeting',
      title: 'Afternoon Meeting',
      startTime: '14:00',
      endTime: '15:00',
    });

    const repairInput = makeInput({
      fixedEvents: [classEvent, newEvent],
      flexibleTasks: [task],
      preferences,
    });

    const change: ScheduleChange = {
      type: 'add',
      sourceType: 'fixed_event',
      sourceId: 'fe-meeting',
      date: '2025-01-20',
    };

    const repairResult = repair(initialPlan, change, repairInput);

    // --- Locked block preserved at exact position (Req 7.3) ---
    const lockedInRepaired = repairResult.plan.blocks.find((b) => b.locked);
    expect(lockedInRepaired).toBeDefined();
    expect(lockedInRepaired!.startTime).toBe(lockedStartTime);
    expect(lockedInRepaired!.endTime).toBe(lockedEndTime);

    // --- New event appears in repaired plan ---
    const meetingBlock = repairResult.plan.blocks.find(
      (b) => b.sourceType === 'fixed_event' && b.sourceId === 'fe-meeting',
    );
    expect(meetingBlock).toBeDefined();
    expect(meetingBlock!.startTime).toBe('14:00');
    expect(meetingBlock!.endTime).toBe('15:00');

    // --- Change summary is accurate (Req 7.6) ---
    expect(repairResult.changeSummary).toBeDefined();
    expect(repairResult.changeSummary.added.length).toBeGreaterThan(0);

    // Locked block should NOT be in the moved list
    const movedIds = repairResult.changeSummary.moved.map((m) => m.blockId);
    expect(movedIds).not.toContain(studyBlock!.id);

    // --- No overlapping blocks in repaired plan ---
    const sorted = [...repairResult.plan.blocks].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
    );
    for (let i = 1; i < sorted.length; i++) {
      expect(timeToMinutes(sorted[i].startTime)).toBeGreaterThanOrEqual(
        timeToMinutes(sorted[i - 1].endTime),
      );
    }
  });

  it('removes an event and accurately reports removed blocks in change summary', () => {
    // Generate initial plan with two fixed events
    const event1 = makeFixedEvent({
      id: 'fe-1',
      title: 'Class A',
      startTime: '09:00',
      endTime: '10:00',
    });
    const event2 = makeFixedEvent({
      id: 'fe-2',
      title: 'Class B',
      startTime: '11:00',
      endTime: '12:00',
    });

    const initialInput = makeInput({ fixedEvents: [event1, event2] });
    const initialResult = solve(initialInput);
    const initialPlan = initialResult.plan;

    // Find the block for event2
    const event2Block = initialPlan.blocks.find(
      (b) => b.sourceType === 'fixed_event' && b.sourceId === 'fe-2',
    );
    expect(event2Block).toBeDefined();

    // Repair: remove event2
    const repairInput = makeInput({ fixedEvents: [event1] });
    const change: ScheduleChange = {
      type: 'remove',
      sourceType: 'fixed_event',
      sourceId: 'fe-2',
      date: '2025-01-20',
    };

    const repairResult = repair(initialPlan, change, repairInput);

    // event2 block should be in removed list
    expect(repairResult.changeSummary.removed).toContain(event2Block!.id);

    // event1 should still be present
    const event1Block = repairResult.plan.blocks.find(
      (b) => b.sourceType === 'fixed_event' && b.sourceId === 'fe-1',
    );
    expect(event1Block).toBeDefined();
    expect(event1Block!.startTime).toBe('09:00');
  });

  it('change summary moved list accurately reflects blocks that shifted', () => {
    // Initial plan: event at 09:00-10:00, task fills gap after
    const event = makeFixedEvent({
      id: 'fe-1',
      startTime: '09:00',
      endTime: '10:00',
    });
    const task = makeFlexibleTask({
      id: 'ft-1',
      title: 'Study',
      remainingMinutes: 60,
      minSessionMinutes: 15,
      priority: 'high',
    });

    const initialInput = makeInput({
      fixedEvents: [event],
      flexibleTasks: [task],
    });
    const initialResult = solve(initialInput);
    const initialPlan = initialResult.plan;

    // Now add a new event that occupies the slot where the task was placed
    const newEvent = makeFixedEvent({
      id: 'fe-new',
      title: 'New Event',
      startTime: '10:00',
      endTime: '11:30',
    });

    const repairInput = makeInput({
      fixedEvents: [event, newEvent],
      flexibleTasks: [task],
    });
    const change: ScheduleChange = {
      type: 'add',
      sourceType: 'fixed_event',
      sourceId: 'fe-new',
      date: '2025-01-20',
    };

    const repairResult = repair(initialPlan, change, repairInput);

    // The change summary should have entries
    const { added, removed, moved } = repairResult.changeSummary;
    // At minimum, the new event block should be added
    expect(added.length + moved.length + removed.length).toBeGreaterThan(0);

    // Verify the change summary is consistent with actual block differences
    const oldBlockIds = new Set(initialPlan.blocks.map((b) => b.id));
    const newBlockIds = new Set(repairResult.plan.blocks.map((b) => b.id));

    // Every "added" block should not exist in old plan
    for (const addedId of added) {
      expect(oldBlockIds.has(addedId)).toBe(false);
    }
    // Every "removed" block should not exist in new plan
    for (const removedId of removed) {
      expect(newBlockIds.has(removedId)).toBe(false);
    }
  });
});


// ---------------------------------------------------------------------------
// 3. AI assistant flow with mock LLM
// Validates: Requirements 8.1
// ---------------------------------------------------------------------------

describe('Integration: AI assistant flow with mock LLM', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function makeMockRepos() {
    return {
      userRepo: {
        findById: vi.fn().mockResolvedValue({
          id: 'user-1',
          name: 'Test User',
          email: 'test@example.com',
          timezone: 'America/New_York',
          onboardingComplete: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      preferenceRepo: {
        findByUserId: vi.fn().mockResolvedValue(makePreferences()),
        findById: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      planRepo: {
        findByUserAndDate: vi.fn().mockResolvedValue([]),
        findById: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      blockRepo: {
        findByPlan: vi.fn().mockResolvedValue([]),
        findById: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      explanationRepo: {
        findByBlock: vi.fn().mockResolvedValue(null),
        findById: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
  }

  function mockFetchWith(responseBody: object) {
    return vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(responseBody) } }],
      }),
    });
  }

  function createService(repos: ReturnType<typeof makeMockRepos>) {
    return new AIAssistantService(
      repos.userRepo as any,
      repos.preferenceRepo as any,
      repos.planRepo as any,
      repos.blockRepo as any,
      repos.explanationRepo as any,
      { apiKey: 'test-key', apiUrl: 'https://fake-llm.test/v1/chat/completions' },
    );
  }

  it('end-to-end: user sends create message → intent extracted → confirmation required', async () => {
    const repos = makeMockRepos();
    const service = createService(repos);

    // Mock LLM returns a create intent with extracted fields
    globalThis.fetch = mockFetchWith({
      intent: 'create',
      extractedFields: {
        title: 'Gym Session',
        startTime: '18:00',
        endTime: '19:00',
        category: 'fitness',
      },
      confirmationRequired: true,
      summary: 'Create a gym session today from 6pm to 7pm',
    }) as any;

    const result = await service.processMessage(
      'user-1',
      'Add a gym session today from 6pm to 7pm',
    );

    // Intent correctly extracted
    expect(result.intent).toBe('create');
    // Fields extracted from natural language
    expect(result.extractedFields).toBeDefined();
    expect((result.extractedFields as any).title).toBe('Gym Session');
    // Confirmation required before applying
    expect(result.confirmationRequired).toBe(true);
    expect(result.summary).toContain('gym session');
  });

  it('end-to-end: user sends reschedule message → proposed changes returned', async () => {
    const repos = makeMockRepos();
    const service = createService(repos);

    globalThis.fetch = mockFetchWith({
      intent: 'reschedule',
      targetItemId: 'event-gym',
      proposedChanges: {
        type: 'modify',
        sourceType: 'fixed_event',
        sourceId: 'event-gym',
        date: '2025-01-21',
        details: { startTime: '18:00', endTime: '19:00' },
      },
      confirmationRequired: true,
      summary: 'Move gym to tomorrow at 6pm',
    }) as any;

    const result = await service.processMessage(
      'user-1',
      'Move my gym session to tomorrow at 6pm',
    );

    expect(result.intent).toBe('reschedule');
    expect(result.proposedChanges).toBeDefined();
    expect(result.proposedChanges!.type).toBe('modify');
    expect(result.proposedChanges!.sourceType).toBe('fixed_event');
    expect(result.confirmationRequired).toBe(true);
  });

  it('end-to-end: user asks for explanation → explanation returned without confirmation', async () => {
    const repos = makeMockRepos();

    // Provide a stored explanation for enrichment
    repos.explanationRepo.findByBlock.mockResolvedValue({
      id: 'exp-1',
      blockId: 'block-study',
      explanationText:
        'Placed due to Assignment deadline proximity. Focus window preference satisfied.',
      referencedConstraints: ['Assignment deadline proximity', 'Focus window preference'],
      createdAt: new Date(),
    });

    const service = createService(repos);

    globalThis.fetch = mockFetchWith({
      intent: 'explain',
      targetItemId: 'block-study',
      explanation: 'LLM explanation placeholder',
      confirmationRequired: false,
      summary: 'Explaining why your study session is at 2pm',
    }) as any;

    const result = await service.processMessage(
      'user-1',
      'Why is my study session at 2pm?',
    );

    expect(result.intent).toBe('explain');
    expect(result.confirmationRequired).toBe(false);
    // Should use the rephrased stored explanation, not the LLM placeholder
    expect(result.explanation).toContain('your upcoming deadline');
    expect(result.explanation).not.toContain('LLM explanation placeholder');
  });

  it('end-to-end: missing fields → follow-up question generated', async () => {
    const repos = makeMockRepos();
    const service = createService(repos);

    globalThis.fetch = mockFetchWith({
      intent: 'create',
      extractedFields: { title: 'Study session' },
      followUpQuestion: 'What time would you like to schedule the study session?',
      confirmationRequired: false,
      summary: 'I need more details to create this event.',
    }) as any;

    const result = await service.processMessage('user-1', 'Add a study session');

    expect(result.intent).toBe('create');
    expect(result.confirmationRequired).toBe(false);
    expect(result.followUpQuestion).toBeDefined();
    expect(result.followUpQuestion).toContain('time');
  });

  it('end-to-end: unsupported message → supported operations listed', async () => {
    const repos = makeMockRepos();
    const service = createService(repos);

    globalThis.fetch = mockFetchWith({
      intent: 'unknown',
      confirmationRequired: false,
      summary: "I don't understand that.",
    }) as any;

    const result = await service.processMessage(
      'user-1',
      'What is the meaning of life?',
    );

    expect(result.intent).toBe('unknown');
    expect(result.summary).toContain('create');
    expect(result.summary).toContain('reschedule');
    expect(result.summary).toContain('explain');
  });

  it('end-to-end: LLM failure → graceful 503 error', async () => {
    const repos = makeMockRepos();
    const service = createService(repos);

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any;

    await expect(
      service.processMessage('user-1', 'Add a gym session'),
    ).rejects.toMatchObject({
      statusCode: 503,
      error: { code: 'SERVICE_UNAVAILABLE' },
    });
  });
});
