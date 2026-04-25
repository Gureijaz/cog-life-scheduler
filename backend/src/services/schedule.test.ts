import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduleService } from './schedule';
import type {
  SchedulePlan,
  ScheduleBlock,
  Explanation,
  PreferenceProfile,
  FixedEvent,
  FlexibleTask,
  Assignment,
  TravelRule,
} from '../types/domain';
import type { ScheduleResult, RepairResult, ScheduleChange } from '../types/engine';
import type {
  PreferenceProfileRepository,
  FixedEventRepository,
  FlexibleTaskRepository,
  AssignmentRepository,
  TravelRuleRepository,
  SchedulePlanRepository,
  ScheduleBlockRepository,
  ExplanationRepository,
} from '../repositories/entities';
import type { Pool } from 'pg';

// ── Mock engine modules ───────────────────────────────────

vi.mock('../engine/solver', () => ({
  solve: vi.fn(),
}));
vi.mock('../engine/repair', () => ({
  repair: vi.fn(),
}));
vi.mock('../db', () => ({
  withTransaction: vi.fn(async (_pool: unknown, fn: (client: unknown) => Promise<unknown>) => fn({})),
}));

import { solve } from '../engine/solver';
import { repair } from '../engine/repair';

// ── Sample data ───────────────────────────────────────────

const samplePreferences: PreferenceProfile = {
  id: 'pref-1',
  userId: 'u-1',
  wakeTime: '07:00',
  sleepTime: '23:00',
  focusWindows: [],
  workoutWindows: [],
  minBufferMinutes: 5,
  maxDeepWorkMinutes: 90,
  defaultCommuteMinutes: 15,
  autoRepairEnabled: false,
  updatedAt: new Date(),
};

const sampleBlock: ScheduleBlock = {
  id: 'blk-1',
  planId: 'plan-1',
  sourceType: 'fixed_event',
  sourceId: 'evt-1',
  title: 'Math Class',
  startTime: '09:00',
  endTime: '10:00',
  locationId: null,
  locked: false,
  sortOrder: 0,
};

const sampleLockedBlock: ScheduleBlock = {
  ...sampleBlock,
  id: 'blk-locked',
  locked: true,
};

const samplePlan: SchedulePlan = {
  id: 'plan-1',
  userId: 'u-1',
  planDate: '2025-01-20',
  version: 1,
  generatedAt: new Date(),
  blocks: [sampleBlock],
};

const sampleExplanation: Explanation = {
  id: 'exp-1',
  blockId: 'blk-1',
  explanationText: 'Placed as Fixed_Event hard constraint.',
  referencedConstraints: ['Fixed_Event conflict'],
  createdAt: new Date(),
};

const sampleSolveResult: ScheduleResult = {
  plan: samplePlan,
  unscheduledItems: [],
  explanations: new Map([['blk-1', sampleExplanation]]),
  atRiskAssignments: [],
};

// ── Mock repository factories ─────────────────────────────

function mockRepo<T>(overrides: Record<string, unknown> = {}) {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (data: unknown) => ({ id: 'new-id', ...(data as object) })),
    update: vi.fn().mockImplementation(async (id: string, data: unknown) => ({ id, ...(data as object) })),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as T;
}

function mockPrefRepo(overrides: Record<string, unknown> = {}) {
  return mockRepo<PreferenceProfileRepository>({
    findByUserId: vi.fn().mockResolvedValue(samplePreferences),
    ...overrides,
  });
}

function mockFixedEventRepo(overrides: Record<string, unknown> = {}) {
  return mockRepo<FixedEventRepository>({
    findByUserAndDate: vi.fn().mockResolvedValue([]),
    ...overrides,
  });
}

function mockFlexTaskRepo(overrides: Record<string, unknown> = {}) {
  return mockRepo<FlexibleTaskRepository>({
    findByUser: vi.fn().mockResolvedValue([]),
    ...overrides,
  });
}

function mockAssignmentRepo(overrides: Record<string, unknown> = {}) {
  return mockRepo<AssignmentRepository>({
    findByUser: vi.fn().mockResolvedValue([]),
    ...overrides,
  });
}

function mockTravelRuleRepo(overrides: Record<string, unknown> = {}) {
  return mockRepo<TravelRuleRepository>({
    findByUser: vi.fn().mockResolvedValue([]),
    ...overrides,
  });
}

function mockPlanRepo(overrides: Record<string, unknown> = {}) {
  return mockRepo<SchedulePlanRepository>({
    findByUserAndDate: vi.fn().mockResolvedValue([]),
    ...overrides,
  });
}

function mockBlockRepo(overrides: Record<string, unknown> = {}) {
  return mockRepo<ScheduleBlockRepository>({
    findByPlan: vi.fn().mockResolvedValue([]),
    ...overrides,
  });
}

function mockExplanationRepo(overrides: Record<string, unknown> = {}) {
  return mockRepo<ExplanationRepository>({
    findByBlock: vi.fn().mockResolvedValue(null),
    ...overrides,
  });
}

const mockPool = {} as Pool;

// ── Helper to build service with defaults ─────────────────

function buildService(overrides: {
  prefRepo?: PreferenceProfileRepository;
  fixedEventRepo?: FixedEventRepository;
  flexTaskRepo?: FlexibleTaskRepository;
  assignmentRepo?: AssignmentRepository;
  travelRuleRepo?: TravelRuleRepository;
  planRepo?: SchedulePlanRepository;
  blockRepo?: ScheduleBlockRepository;
  explanationRepo?: ExplanationRepository;
} = {}) {
  return new ScheduleService(
    mockPool,
    overrides.prefRepo ?? mockPrefRepo(),
    overrides.fixedEventRepo ?? mockFixedEventRepo(),
    overrides.flexTaskRepo ?? mockFlexTaskRepo(),
    overrides.assignmentRepo ?? mockAssignmentRepo(),
    overrides.travelRuleRepo ?? mockTravelRuleRepo(),
    overrides.planRepo ?? mockPlanRepo(),
    overrides.blockRepo ?? mockBlockRepo(),
    overrides.explanationRepo ?? mockExplanationRepo(),
  );
}

describe('ScheduleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── generateSchedule ─────────────────────────────────

  describe('generateSchedule', () => {
    it('fetches inputs, calls solve, and persists the result', async () => {
      (solve as ReturnType<typeof vi.fn>).mockReturnValue(sampleSolveResult);

      const planRepo = mockPlanRepo();
      const blockRepo = mockBlockRepo();
      const explanationRepo = mockExplanationRepo();
      const service = buildService({ planRepo, blockRepo, explanationRepo });

      const result = await service.generateSchedule('u-1', '2025-01-20');

      expect(solve).toHaveBeenCalledOnce();
      expect(result.plan).toBeDefined();
      expect(result.plan.blocks).toHaveLength(1);
      // Plan and blocks should be persisted
      expect(planRepo.create).toHaveBeenCalledOnce();
      expect(blockRepo.create).toHaveBeenCalledOnce();
      expect(explanationRepo.create).toHaveBeenCalledOnce();
    });

    it('preserves locked blocks from existing plan on regeneration', async () => {
      const existingPlan: SchedulePlan = {
        ...samplePlan,
        blocks: [sampleLockedBlock],
      };
      (solve as ReturnType<typeof vi.fn>).mockReturnValue(sampleSolveResult);

      const planRepo = mockPlanRepo({
        findByUserAndDate: vi.fn().mockResolvedValue([existingPlan]),
      });
      const blockRepo = mockBlockRepo({
        findByPlan: vi.fn().mockResolvedValue([sampleLockedBlock]),
      });
      const service = buildService({ planRepo, blockRepo });

      await service.generateSchedule('u-1', '2025-01-20');

      const solveCall = (solve as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(solveCall.lockedBlocks).toHaveLength(1);
      expect(solveCall.lockedBlocks[0].id).toBe('blk-locked');
    });

    it('throws NOT_FOUND when user has no preference profile', async () => {
      const prefRepo = mockPrefRepo({
        findByUserId: vi.fn().mockResolvedValue(null),
      });
      const service = buildService({ prefRepo });

      await expect(service.generateSchedule('u-1', '2025-01-20')).rejects.toMatchObject({
        error: { code: 'NOT_FOUND' },
      });
    });

    it('passes updated preferences to the solver', async () => {
      const updatedPrefs: PreferenceProfile = {
        ...samplePreferences,
        wakeTime: '06:00',
        sleepTime: '22:00',
        minBufferMinutes: 10,
        maxDeepWorkMinutes: 60,
        autoRepairEnabled: true,
      };
      (solve as ReturnType<typeof vi.fn>).mockReturnValue(sampleSolveResult);

      const prefRepo = mockPrefRepo({
        findByUserId: vi.fn().mockResolvedValue(updatedPrefs),
      });
      const service = buildService({ prefRepo });

      await service.generateSchedule('u-1', '2025-01-20');

      const solveInput = (solve as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(solveInput.preferences.wakeTime).toBe('06:00');
      expect(solveInput.preferences.sleepTime).toBe('22:00');
      expect(solveInput.preferences.minBufferMinutes).toBe(10);
      expect(solveInput.preferences.maxDeepWorkMinutes).toBe(60);
    });

    it('increments version when regenerating an existing plan', async () => {
      const existingPlan: SchedulePlan = { ...samplePlan, version: 2, blocks: [] };
      (solve as ReturnType<typeof vi.fn>).mockReturnValue(sampleSolveResult);

      const planRepo = mockPlanRepo({
        findByUserAndDate: vi.fn().mockResolvedValue([existingPlan]),
      });
      const service = buildService({ planRepo });

      await service.generateSchedule('u-1', '2025-01-20');

      const createArg = (planRepo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(createArg.version).toBe(3);
    });
  });

  // ── repairSchedule ───────────────────────────────────

  describe('repairSchedule', () => {
    it('fetches plan, calls repair, and returns result without persisting', async () => {
      const repairResult: RepairResult = {
        ...sampleSolveResult,
        changeSummary: { moved: [], added: ['blk-new'], removed: [] },
      };
      (repair as ReturnType<typeof vi.fn>).mockReturnValue(repairResult);

      const planRepo = mockPlanRepo({
        findById: vi.fn().mockResolvedValue(samplePlan),
      });
      const blockRepo = mockBlockRepo({
        findByPlan: vi.fn().mockResolvedValue([sampleBlock]),
      });
      const service = buildService({ planRepo, blockRepo });

      const change: ScheduleChange = {
        type: 'add',
        sourceType: 'fixed_event',
        date: '2025-01-20',
      };

      const result = await service.repairSchedule('u-1', 'plan-1', change);

      expect(repair).toHaveBeenCalledOnce();
      expect(result.changeSummary.added).toContain('blk-new');
      // Should NOT persist — no create calls on planRepo
      expect(planRepo.create).not.toHaveBeenCalled();
    });

    it('does not persist blocks or plans (confirmation gating)', async () => {
      const repairResult: RepairResult = {
        ...sampleSolveResult,
        changeSummary: { moved: [{ blockId: 'blk-1', oldStart: '09:00', newStart: '10:00' }], added: [], removed: [] },
      };
      (repair as ReturnType<typeof vi.fn>).mockReturnValue(repairResult);

      const planRepo = mockPlanRepo({
        findById: vi.fn().mockResolvedValue(samplePlan),
      });
      const blockRepo = mockBlockRepo({
        findByPlan: vi.fn().mockResolvedValue([sampleBlock]),
      });
      const explanationRepo = mockExplanationRepo();
      const service = buildService({ planRepo, blockRepo, explanationRepo });

      const change: ScheduleChange = {
        type: 'modify',
        sourceType: 'fixed_event',
        date: '2025-01-20',
      };

      await service.repairSchedule('u-1', 'plan-1', change);

      // Confirmation gating: no persistence calls
      expect(planRepo.create).not.toHaveBeenCalled();
      expect(blockRepo.create).not.toHaveBeenCalled();
      expect(blockRepo.update).not.toHaveBeenCalled();
      expect(explanationRepo.create).not.toHaveBeenCalled();
    });

    it('returns change summary for user confirmation review', async () => {
      const repairResult: RepairResult = {
        ...sampleSolveResult,
        changeSummary: {
          moved: [{ blockId: 'blk-1', oldStart: '09:00', newStart: '11:00' }],
          added: ['blk-new'],
          removed: ['blk-old'],
        },
      };
      (repair as ReturnType<typeof vi.fn>).mockReturnValue(repairResult);

      const planRepo = mockPlanRepo({
        findById: vi.fn().mockResolvedValue(samplePlan),
      });
      const blockRepo = mockBlockRepo({
        findByPlan: vi.fn().mockResolvedValue([sampleBlock]),
      });
      const service = buildService({ planRepo, blockRepo });

      const change: ScheduleChange = {
        type: 'add',
        sourceType: 'flexible_task',
        date: '2025-01-20',
      };

      const result = await service.repairSchedule('u-1', 'plan-1', change);

      // Change summary is returned for the caller to present to the user
      expect(result.changeSummary).toBeDefined();
      expect(result.changeSummary.moved).toHaveLength(1);
      expect(result.changeSummary.added).toContain('blk-new');
      expect(result.changeSummary.removed).toContain('blk-old');
    });

    it('auto-repair preference is available via fetched inputs for caller decision', async () => {
      const autoRepairPrefs: PreferenceProfile = {
        ...samplePreferences,
        autoRepairEnabled: true,
      };
      const repairResult: RepairResult = {
        ...sampleSolveResult,
        changeSummary: { moved: [], added: [], removed: [] },
      };
      (repair as ReturnType<typeof vi.fn>).mockReturnValue(repairResult);

      const prefRepo = mockPrefRepo({
        findByUserId: vi.fn().mockResolvedValue(autoRepairPrefs),
      });
      const planRepo = mockPlanRepo({
        findById: vi.fn().mockResolvedValue(samplePlan),
      });
      const blockRepo = mockBlockRepo({
        findByPlan: vi.fn().mockResolvedValue([sampleBlock]),
      });
      const service = buildService({ prefRepo, planRepo, blockRepo });

      const change: ScheduleChange = {
        type: 'add',
        sourceType: 'fixed_event',
        date: '2025-01-20',
      };

      // Repair still returns without persisting — caller checks autoRepairEnabled
      const result = await service.repairSchedule('u-1', 'plan-1', change);

      expect(result).toBeDefined();
      expect(planRepo.create).not.toHaveBeenCalled();

      // The repair engine received the preferences with autoRepairEnabled
      const repairCall = (repair as ReturnType<typeof vi.fn>).mock.calls[0];
      const repairInput = repairCall[2]; // third arg is ScheduleInput
      expect(repairInput.preferences.autoRepairEnabled).toBe(true);
    });

    it('throws NOT_FOUND when plan does not exist', async () => {
      const service = buildService();

      const change: ScheduleChange = {
        type: 'add',
        sourceType: 'fixed_event',
        date: '2025-01-20',
      };

      await expect(service.repairSchedule('u-1', 'missing', change)).rejects.toMatchObject({
        error: { code: 'NOT_FOUND' },
      });
    });
  });

  // ── lockBlock / unlockBlock ──────────────────────────

  describe('lockBlock', () => {
    it('sets locked to true and returns updated block', async () => {
      const blockRepo = mockBlockRepo({
        findById: vi.fn().mockResolvedValue(sampleBlock),
        update: vi.fn().mockResolvedValue({ ...sampleBlock, locked: true }),
      });
      const service = buildService({ blockRepo });

      const result = await service.lockBlock('blk-1');

      expect(blockRepo.update).toHaveBeenCalledWith('blk-1', { locked: true });
      expect(result.locked).toBe(true);
    });

    it('throws NOT_FOUND when block does not exist', async () => {
      const service = buildService();

      await expect(service.lockBlock('missing')).rejects.toMatchObject({
        error: { code: 'NOT_FOUND' },
      });
    });
  });

  describe('unlockBlock', () => {
    it('sets locked to false and returns updated block', async () => {
      const blockRepo = mockBlockRepo({
        findById: vi.fn().mockResolvedValue(sampleLockedBlock),
        update: vi.fn().mockResolvedValue({ ...sampleLockedBlock, locked: false }),
      });
      const service = buildService({ blockRepo });

      const result = await service.unlockBlock('blk-locked');

      expect(blockRepo.update).toHaveBeenCalledWith('blk-locked', { locked: false });
      expect(result.locked).toBe(false);
    });

    it('throws NOT_FOUND when block does not exist', async () => {
      const service = buildService();

      await expect(service.unlockBlock('missing')).rejects.toMatchObject({
        error: { code: 'NOT_FOUND' },
      });
    });
  });

  // ── getSchedulePlan ──────────────────────────────────

  describe('getSchedulePlan', () => {
    it('returns the latest plan with blocks for a date', async () => {
      const plan1: SchedulePlan = { ...samplePlan, version: 1, blocks: [] };
      const plan2: SchedulePlan = { ...samplePlan, id: 'plan-2', version: 2, blocks: [] };

      const planRepo = mockPlanRepo({
        findByUserAndDate: vi.fn().mockResolvedValue([plan1, plan2]),
      });
      const blockRepo = mockBlockRepo({
        findByPlan: vi.fn().mockResolvedValue([sampleBlock]),
      });
      const service = buildService({ planRepo, blockRepo });

      const result = await service.getSchedulePlan('u-1', '2025-01-20');

      expect(result.version).toBe(2);
      expect(result.blocks).toHaveLength(1);
      expect(blockRepo.findByPlan).toHaveBeenCalledWith('plan-2');
    });

    it('throws NOT_FOUND when no plan exists for the date', async () => {
      const service = buildService();

      await expect(service.getSchedulePlan('u-1', '2025-01-20')).rejects.toMatchObject({
        error: { code: 'NOT_FOUND' },
      });
    });
  });

  // ── getWeekPlan ──────────────────────────────────────

  describe('getWeekPlan', () => {
    it('returns plans for days that have them, skips days without', async () => {
      const planForDay: SchedulePlan = { ...samplePlan, blocks: [] };

      // Return a plan only for the first date queried
      let callCount = 0;
      const planRepo = mockPlanRepo({
        findByUserAndDate: vi.fn().mockImplementation(async () => {
          callCount++;
          return callCount === 1 ? [planForDay] : [];
        }),
      });
      const blockRepo = mockBlockRepo({
        findByPlan: vi.fn().mockResolvedValue([sampleBlock]),
      });
      const service = buildService({ planRepo, blockRepo });

      const result = await service.getWeekPlan('u-1', '2025-01-20');

      expect(result).toHaveLength(1);
    });
  });

  // ── getExplanation ───────────────────────────────────

  describe('getExplanation', () => {
    it('returns the explanation for a block', async () => {
      const explanationRepo = mockExplanationRepo({
        findByBlock: vi.fn().mockResolvedValue(sampleExplanation),
      });
      const service = buildService({ explanationRepo });

      const result = await service.getExplanation('blk-1');

      expect(result.explanationText).toBe('Placed as Fixed_Event hard constraint.');
      expect(result.referencedConstraints).toContain('Fixed_Event conflict');
    });

    it('throws NOT_FOUND when no explanation exists', async () => {
      const service = buildService();

      await expect(service.getExplanation('missing')).rejects.toMatchObject({
        error: { code: 'NOT_FOUND' },
      });
    });
  });
});
