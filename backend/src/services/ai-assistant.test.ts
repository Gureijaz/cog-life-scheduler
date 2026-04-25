// Unit tests for AI Assistant service
// Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 9.2, 9.4

import { describe, it, expect, vi } from 'vitest';
import {
  nowInTimezone,
  buildSystemPrompt,
  parseLLMResponse,
  rephraseExplanation,
  SUPPORTED_OPERATIONS_MESSAGE,
  AIAssistantService,
} from './ai-assistant';
import type { User, PreferenceProfile, ScheduleBlock, Explanation } from '../types/domain';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    timezone: 'America/New_York',
    onboardingComplete: true,
    createdAt: new Date(),
    updatedAt: new Date(),
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

function makeBlock(overrides: Partial<ScheduleBlock> = {}): ScheduleBlock {
  return {
    id: 'block-1',
    planId: 'plan-1',
    sourceType: 'fixed_event',
    sourceId: 'event-1',
    title: 'Morning Meeting',
    startTime: '09:00',
    endTime: '10:00',
    locationId: null,
    locked: false,
    sortOrder: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// nowInTimezone
// ---------------------------------------------------------------------------

describe('nowInTimezone', () => {
  it('returns a valid ISO date and time string for UTC', () => {
    const result = nowInTimezone('UTC');
    expect(result.isoDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.timeStr).toMatch(/^\d{2}:\d{2}$/);
    expect(result.now).toBeInstanceOf(Date);
  });

  it('returns a valid ISO date for a non-UTC timezone', () => {
    const result = nowInTimezone('America/New_York');
    expect(result.isoDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.timeStr).toMatch(/^\d{2}:\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// buildSystemPrompt
// ---------------------------------------------------------------------------

describe('buildSystemPrompt', () => {
  it('includes user name, timezone, and current date/time', () => {
    const prompt = buildSystemPrompt(
      makeUser(),
      makePreferences(),
      [],
      'America/New_York',
      '2025-01-20',
      '14:30',
    );
    expect(prompt).toContain('Test User');
    expect(prompt).toContain('America/New_York');
    expect(prompt).toContain('2025-01-20');
    expect(prompt).toContain('14:30');
  });

  it('includes schedule blocks when present', () => {
    const blocks = [
      makeBlock({ title: 'Morning Meeting', startTime: '09:00', endTime: '10:00' }),
      makeBlock({ id: 'block-2', title: 'Lunch', startTime: '12:00', endTime: '13:00', sourceType: 'flexible_task' }),
    ];
    const prompt = buildSystemPrompt(
      makeUser(),
      makePreferences(),
      blocks,
      'UTC',
      '2025-01-20',
      '14:30',
    );
    expect(prompt).toContain('Morning Meeting');
    expect(prompt).toContain('09:00');
    expect(prompt).toContain('Lunch');
    expect(prompt).toContain('flexible_task');
  });

  it('shows placeholder when no blocks are scheduled', () => {
    const prompt = buildSystemPrompt(
      makeUser(),
      null,
      [],
      'UTC',
      '2025-01-20',
      '14:30',
    );
    expect(prompt).toContain('no blocks scheduled today');
  });

  it('includes preference details', () => {
    const prompt = buildSystemPrompt(
      makeUser(),
      makePreferences({ wakeTime: '06:30', sleepTime: '22:00' }),
      [],
      'UTC',
      '2025-01-20',
      '14:30',
    );
    expect(prompt).toContain('06:30');
    expect(prompt).toContain('22:00');
  });

  it('includes all available operations', () => {
    const prompt = buildSystemPrompt(makeUser(), makePreferences(), [], 'UTC', '2025-01-20', '14:30');
    expect(prompt).toContain('create');
    expect(prompt).toContain('edit');
    expect(prompt).toContain('delete');
    expect(prompt).toContain('reschedule');
    expect(prompt).toContain('explain');
  });

  it('shows locked status for locked blocks', () => {
    const blocks = [makeBlock({ locked: true })];
    const prompt = buildSystemPrompt(makeUser(), makePreferences(), blocks, 'UTC', '2025-01-20', '14:30');
    expect(prompt).toContain('locked');
  });
});

// ---------------------------------------------------------------------------
// parseLLMResponse
// ---------------------------------------------------------------------------

describe('parseLLMResponse', () => {
  it('parses a valid create intent response', () => {
    const raw = JSON.stringify({
      intent: 'create',
      extractedFields: { title: 'Gym Session', category: 'fitness' },
      confirmationRequired: true,
      summary: 'Create a gym session for tomorrow at 6pm',
    });
    const result = parseLLMResponse(raw);
    expect(result.intent).toBe('create');
    expect(result.extractedFields).toEqual({ title: 'Gym Session', category: 'fitness' });
    expect(result.confirmationRequired).toBe(true);
    expect(result.summary).toBe('Create a gym session for tomorrow at 6pm');
  });

  it('parses a valid reschedule intent with proposedChanges', () => {
    const raw = JSON.stringify({
      intent: 'reschedule',
      targetItemId: 'event-123',
      proposedChanges: {
        type: 'modify',
        sourceType: 'fixed_event',
        sourceId: 'event-123',
        date: '2025-01-21',
        details: { startTime: '18:00', endTime: '19:00' },
      },
      confirmationRequired: true,
      summary: 'Move gym to tomorrow at 6pm',
    });
    const result = parseLLMResponse(raw);
    expect(result.intent).toBe('reschedule');
    expect(result.targetItemId).toBe('event-123');
    expect(result.proposedChanges).toBeDefined();
    expect(result.proposedChanges!.type).toBe('modify');
    expect(result.proposedChanges!.sourceType).toBe('fixed_event');
    expect(result.proposedChanges!.date).toBe('2025-01-21');
  });

  it('parses an explain intent', () => {
    const raw = JSON.stringify({
      intent: 'explain',
      targetItemId: 'block-456',
      explanation: 'This block was placed here because of your focus window preference.',
      confirmationRequired: false,
      summary: 'Explaining why your study session is at 2pm',
    });
    const result = parseLLMResponse(raw);
    expect(result.intent).toBe('explain');
    expect(result.explanation).toContain('focus window');
    expect(result.confirmationRequired).toBe(false);
  });

  it('parses a delete intent', () => {
    const raw = JSON.stringify({
      intent: 'delete',
      targetItemId: 'task-789',
      proposedChanges: {
        type: 'remove',
        sourceType: 'flexible_task',
        sourceId: 'task-789',
        date: '2025-01-20',
      },
      confirmationRequired: true,
      summary: 'Delete the workout task',
    });
    const result = parseLLMResponse(raw);
    expect(result.intent).toBe('delete');
    expect(result.proposedChanges!.type).toBe('remove');
  });

  it('handles unknown intent gracefully', () => {
    const raw = JSON.stringify({
      intent: 'unknown',
      confirmationRequired: false,
      summary: "I'm not sure what you mean. I can help you create, edit, delete, reschedule, or explain schedule items.",
    });
    const result = parseLLMResponse(raw);
    expect(result.intent).toBe('unknown');
    expect(result.confirmationRequired).toBe(false);
  });

  it('falls back to unknown for invalid intent values', () => {
    const raw = JSON.stringify({
      intent: 'fly_to_moon',
      confirmationRequired: false,
      summary: 'Something weird',
    });
    const result = parseLLMResponse(raw);
    expect(result.intent).toBe('unknown');
  });

  it('handles markdown-wrapped JSON from LLM', () => {
    const raw = '```json\n{"intent":"create","confirmationRequired":true,"summary":"Create event"}\n```';
    const result = parseLLMResponse(raw);
    expect(result.intent).toBe('create');
  });

  it('defaults confirmationRequired to true when missing', () => {
    const raw = JSON.stringify({ intent: 'create', summary: 'Create something' });
    const result = parseLLMResponse(raw);
    expect(result.confirmationRequired).toBe(true);
  });

  it('defaults summary when missing', () => {
    const raw = JSON.stringify({ intent: 'create' });
    const result = parseLLMResponse(raw);
    expect(result.summary).toBe('I processed your request.');
  });

  it('parses follow-up question for missing fields', () => {
    const raw = JSON.stringify({
      intent: 'create',
      extractedFields: { title: 'Study session' },
      followUpQuestion: 'What time would you like to schedule the study session?',
      confirmationRequired: false,
      summary: 'I need more details to create this event.',
    });
    const result = parseLLMResponse(raw);
    expect(result.followUpQuestion).toContain('What time');
    expect(result.confirmationRequired).toBe(false);
  });

  it('ignores invalid proposedChanges gracefully', () => {
    const raw = JSON.stringify({
      intent: 'reschedule',
      proposedChanges: { type: 'invalid_type', sourceType: 'bad' },
      confirmationRequired: true,
      summary: 'Reschedule something',
    });
    const result = parseLLMResponse(raw);
    expect(result.proposedChanges).toBeUndefined();
  });

  it('throws on completely invalid JSON', () => {
    expect(() => parseLLMResponse('not json at all')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// rephraseExplanation
// ---------------------------------------------------------------------------

describe('rephraseExplanation', () => {
  it('rephrases Fixed_Event conflict into conversational language', () => {
    const result = rephraseExplanation('Placed here due to Fixed_Event conflict with morning class.');
    expect(result).toContain('a fixed commitment in your calendar');
    expect(result).not.toContain('Fixed_Event conflict');
  });

  it('rephrases Travel_Rule between locations', () => {
    const result = rephraseExplanation('Travel_Rule between Home and University requires 30 minutes.');
    expect(result).toContain('commute time from Home to University');
    expect(result).not.toContain('Travel_Rule between');
  });

  it('rephrases Assignment deadline proximity', () => {
    const result = rephraseExplanation('Scheduled due to Assignment deadline proximity.');
    expect(result).toContain('your upcoming deadline');
  });

  it('preserves text without technical terms', () => {
    const plain = 'This block is at 2pm because you prefer afternoon study sessions.';
    expect(rephraseExplanation(plain)).toBe(plain);
  });
});

// ---------------------------------------------------------------------------
// Mock helpers for AIAssistantService.processMessage
// ---------------------------------------------------------------------------

function makeMockRepos() {
  return {
    userRepo: {
      findById: vi.fn().mockResolvedValue(makeUser()),
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

/** Create a mock LLM server that returns a given JSON response body. */
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

// ---------------------------------------------------------------------------
// AIAssistantService.processMessage — confirmation flow & error handling
// Validates: Requirements 8.5, 8.6, 8.7, 9.2, 9.4
// ---------------------------------------------------------------------------

describe('AIAssistantService.processMessage', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns confirmationRequired=true for create intent (Req 8.6)', async () => {
    const repos = makeMockRepos();
    const service = createService(repos);

    globalThis.fetch = mockFetchWith({
      intent: 'create',
      extractedFields: { title: 'Gym Session', category: 'fitness' },
      confirmationRequired: true,
      summary: 'Create a gym session for tomorrow at 6pm',
    }) as any;

    const result = await service.processMessage('user-1', 'Add a gym session tomorrow at 6pm');
    expect(result.intent).toBe('create');
    expect(result.confirmationRequired).toBe(true);
    expect(result.summary).toContain('gym session');
  });

  it('returns confirmationRequired=true for edit intent (Req 8.6)', async () => {
    const repos = makeMockRepos();
    const service = createService(repos);

    globalThis.fetch = mockFetchWith({
      intent: 'edit',
      targetItemId: 'event-1',
      proposedChanges: { type: 'modify', sourceType: 'fixed_event', sourceId: 'event-1', date: '2025-01-20', details: { title: 'Updated Meeting' } },
      confirmationRequired: true,
      summary: 'Update the meeting title',
    }) as any;

    const result = await service.processMessage('user-1', 'Rename my meeting to Updated Meeting');
    expect(result.intent).toBe('edit');
    expect(result.confirmationRequired).toBe(true);
  });

  it('returns confirmationRequired=true for delete intent (Req 8.6)', async () => {
    const repos = makeMockRepos();
    const service = createService(repos);

    globalThis.fetch = mockFetchWith({
      intent: 'delete',
      targetItemId: 'task-1',
      proposedChanges: { type: 'remove', sourceType: 'flexible_task', sourceId: 'task-1', date: '2025-01-20' },
      confirmationRequired: true,
      summary: 'Delete the workout task',
    }) as any;

    const result = await service.processMessage('user-1', 'Delete my workout');
    expect(result.intent).toBe('delete');
    expect(result.confirmationRequired).toBe(true);
  });

  it('returns confirmationRequired=true for reschedule intent (Req 8.6)', async () => {
    const repos = makeMockRepos();
    const service = createService(repos);

    globalThis.fetch = mockFetchWith({
      intent: 'reschedule',
      targetItemId: 'event-1',
      proposedChanges: { type: 'modify', sourceType: 'fixed_event', sourceId: 'event-1', date: '2025-01-21', details: { startTime: '18:00' } },
      confirmationRequired: true,
      summary: 'Move gym to tomorrow at 6pm',
    }) as any;

    const result = await service.processMessage('user-1', 'Move gym to tomorrow');
    expect(result.intent).toBe('reschedule');
    expect(result.confirmationRequired).toBe(true);
  });

  it('returns confirmationRequired=false for explain intent (Req 8.6, 9.2)', async () => {
    const repos = makeMockRepos();
    const service = createService(repos);

    globalThis.fetch = mockFetchWith({
      intent: 'explain',
      targetItemId: 'block-1',
      explanation: 'This block was placed here because of your focus window preference.',
      confirmationRequired: false,
      summary: 'Explaining why your study session is at 2pm',
    }) as any;

    const result = await service.processMessage('user-1', 'Why is my study session at 2pm?');
    expect(result.intent).toBe('explain');
    expect(result.confirmationRequired).toBe(false);
  });

  it('enriches explain intent with stored explanation (Req 9.2, 9.4)', async () => {
    const repos = makeMockRepos();
    const storedExplanation: Explanation = {
      id: 'exp-1',
      blockId: 'block-1',
      explanationText: 'Placed due to Assignment deadline proximity and Fixed_Event conflict.',
      referencedConstraints: ['Assignment deadline proximity', 'Fixed_Event conflict'],
      createdAt: new Date(),
    };
    repos.explanationRepo.findByBlock.mockResolvedValue(storedExplanation);
    const service = createService(repos);

    globalThis.fetch = mockFetchWith({
      intent: 'explain',
      targetItemId: 'block-1',
      explanation: 'LLM generated explanation',
      confirmationRequired: false,
      summary: 'Explaining block placement',
    }) as any;

    const result = await service.processMessage('user-1', 'Why is this block here?');
    expect(result.intent).toBe('explain');
    expect(result.confirmationRequired).toBe(false);
    // Should use the rephrased stored explanation, not the LLM one
    expect(result.explanation).toContain('your upcoming deadline');
    expect(result.explanation).toContain('a fixed commitment in your calendar');
    expect(result.explanation).not.toContain('LLM generated explanation');
  });

  it('throws 503 on LLM timeout (Req 8.7)', async () => {
    const repos = makeMockRepos();
    const service = createService(repos);

    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    globalThis.fetch = vi.fn().mockRejectedValue(abortError) as any;

    await expect(service.processMessage('user-1', 'Hello')).rejects.toMatchObject({
      statusCode: 503,
      error: { code: 'SERVICE_UNAVAILABLE' },
    });
  });

  it('throws 503 on LLM network failure (Req 8.7)', async () => {
    const repos = makeMockRepos();
    const service = createService(repos);

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any;

    await expect(service.processMessage('user-1', 'Hello')).rejects.toMatchObject({
      statusCode: 503,
      error: { code: 'SERVICE_UNAVAILABLE' },
    });
  });

  it('returns rephrase message for unparseable LLM response (Req 8.7)', async () => {
    const repos = makeMockRepos();
    const service = createService(repos);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'This is not valid JSON at all!' } }],
      }),
    }) as any;

    const result = await service.processMessage('user-1', 'Do something weird');
    expect(result.intent).toBe('unknown');
    expect(result.confirmationRequired).toBe(false);
    expect(result.summary).toContain('rephrase');
    expect(result.followUpQuestion).toContain('rephrase');
  });

  it('returns supported operations list for unknown intent (Req 8.7)', async () => {
    const repos = makeMockRepos();
    const service = createService(repos);

    globalThis.fetch = mockFetchWith({
      intent: 'unknown',
      confirmationRequired: false,
      summary: "I don't understand that.",
    }) as any;

    const result = await service.processMessage('user-1', 'What is the meaning of life?');
    expect(result.intent).toBe('unknown');
    expect(result.confirmationRequired).toBe(false);
    expect(result.summary).toContain('create');
    expect(result.summary).toContain('edit');
    expect(result.summary).toContain('delete');
    expect(result.summary).toContain('reschedule');
    expect(result.summary).toContain('explain');
  });

  it('generates follow-up question for missing fields (Req 8.5)', async () => {
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
    expect(result.followUpQuestion).toContain('What time');
    expect(result.extractedFields).toEqual({ title: 'Study session' });
  });

  it('throws NOT_FOUND for unknown user', async () => {
    const repos = makeMockRepos();
    repos.userRepo.findById.mockResolvedValue(null);
    const service = createService(repos);

    await expect(service.processMessage('unknown-user', 'Hello')).rejects.toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
  });
});
