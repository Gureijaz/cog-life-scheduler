// Schedule service — schedule generation, repair, locking, and retrieval
// Requirements: 6.1, 6.2, 6.8, 7.1, 7.7, 11.1, 11.2, 11.3, 9.2

import type { Pool } from 'pg';
import type {
  SchedulePlan,
  ScheduleBlock,
  Explanation,
  PreferenceProfile,
} from '../types/domain';
import type {
  ScheduleChange,
  ScheduleResult,
  RepairResult,
} from '../types/engine';
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
import { withTransaction } from '../db';
import { solve } from '../engine/solver';
import { repair } from '../engine/repair';
import { validationError } from '../validation';
import type { ScheduleInput } from '../types/engine';

export class ScheduleService {
  constructor(
    private pool: Pool,
    private preferenceRepo: PreferenceProfileRepository,
    private fixedEventRepo: FixedEventRepository,
    private flexibleTaskRepo: FlexibleTaskRepository,
    private assignmentRepo: AssignmentRepository,
    private travelRuleRepo: TravelRuleRepository,
    private planRepo: SchedulePlanRepository,
    private blockRepo: ScheduleBlockRepository,
    private explanationRepo: ExplanationRepository,
  ) {}

  /** Fetch all scheduling inputs for a user on a given date. */
  private async fetchInputs(
    userId: string,
    date: string,
    existingBlocks: ScheduleBlock[] = [],
  ): Promise<ScheduleInput> {
    const preferences = await this.preferenceRepo.findByUserId(userId);
    if (!preferences) {
      throw validationError(
        'NOT_FOUND',
        `Preference profile not found for user ${userId}`,
        'userId',
        'User has no preference profile',
        userId,
      );
    }

    const [fixedEvents, flexibleTasks, assignments, travelRules] = await Promise.all([
      this.fixedEventRepo.findByUserAndDate(userId, date),
      this.flexibleTaskRepo.findByUser(userId),
      this.assignmentRepo.findByUser(userId),
      this.travelRuleRepo.findByUser(userId),
    ]);

    const lockedBlocks = existingBlocks.filter((b) => b.locked);

    return {
      date,
      fixedEvents,
      flexibleTasks,
      assignments,
      travelRules,
      preferences,
      lockedBlocks,
    };
  }

  /**
   * Generate a schedule for a specific date.
   * If a plan already exists, locked blocks are preserved.
   * Requirements: 6.1, 6.2, 6.8
   */
  async generateSchedule(userId: string, date: string): Promise<ScheduleResult> {
    // Check for existing plan to preserve locked blocks
    const existingPlans = await this.planRepo.findByUserAndDate(userId, date);
    const latestPlan = existingPlans.length > 0
      ? existingPlans.sort((a, b) => b.version - a.version)[0]
      : null;

    let existingBlocks: ScheduleBlock[] = [];
    if (latestPlan) {
      existingBlocks = await this.blockRepo.findByPlan(latestPlan.id);
    }

    const input = await this.fetchInputs(userId, date, existingBlocks);
    const result = solve(input);

    // Persist plan and blocks in a transaction
    await withTransaction(this.pool, async () => {
      const version = latestPlan ? latestPlan.version + 1 : 1;
      await this.planRepo.create({
        userId,
        planDate: date,
        version,
        generatedAt: result.plan.generatedAt,
        blocks: [],
      } as Omit<SchedulePlan, 'id'>);

      // Use the plan id from the result
      for (const block of result.plan.blocks) {
        await this.blockRepo.create({
          planId: result.plan.id,
          sourceType: block.sourceType,
          sourceId: block.sourceId,
          title: block.title,
          startTime: block.startTime,
          endTime: block.endTime,
          locationId: block.locationId,
          locked: block.locked,
          sortOrder: block.sortOrder,
        } as Omit<ScheduleBlock, 'id'>);
      }

      // Persist explanations
      for (const [blockId, explanation] of result.explanations) {
        await this.explanationRepo.create({
          blockId,
          explanationText: explanation.explanationText,
          referencedConstraints: explanation.referencedConstraints,
          createdAt: explanation.createdAt,
        } as Omit<Explanation, 'id'>);
      }
    });

    return result;
  }

  /**
   * Repair an existing schedule plan after a change.
   * Returns the repair result without persisting — caller must confirm.
   * If auto-repair is enabled in preferences, the result can be applied directly.
   * Requirements: 7.1, 7.7
   */
  async repairSchedule(
    userId: string,
    planId: string,
    change: ScheduleChange,
  ): Promise<RepairResult> {
    const plan = await this.planRepo.findById(planId);
    if (!plan) {
      throw validationError(
        'NOT_FOUND',
        `Schedule plan ${planId} not found`,
        'planId',
        'Plan does not exist',
        planId,
      );
    }

    const blocks = await this.blockRepo.findByPlan(planId);
    const planWithBlocks: SchedulePlan = { ...plan, blocks };

    const input = await this.fetchInputs(userId, plan.planDate, blocks);
    const result = repair(planWithBlocks, change, input);

    // Don't persist — return result for confirmation
    // Caller checks preferences.autoRepairEnabled to decide whether to auto-apply
    return result;
  }

  /**
   * Lock a schedule block. Requirement 11.1
   */
  async lockBlock(blockId: string): Promise<ScheduleBlock> {
    const block = await this.blockRepo.findById(blockId);
    if (!block) {
      throw validationError(
        'NOT_FOUND',
        `Schedule block ${blockId} not found`,
        'blockId',
        'Block does not exist',
        blockId,
      );
    }
    return this.blockRepo.update(blockId, { locked: true } as Partial<ScheduleBlock>);
  }

  /**
   * Unlock a schedule block. Requirement 11.2
   */
  async unlockBlock(blockId: string): Promise<ScheduleBlock> {
    const block = await this.blockRepo.findById(blockId);
    if (!block) {
      throw validationError(
        'NOT_FOUND',
        `Schedule block ${blockId} not found`,
        'blockId',
        'Block does not exist',
        blockId,
      );
    }
    return this.blockRepo.update(blockId, { locked: false } as Partial<ScheduleBlock>);
  }

  /**
   * Get the latest schedule plan for a user on a specific date.
   * Requirement 6.1
   */
  async getSchedulePlan(userId: string, date: string): Promise<SchedulePlan> {
    const plans = await this.planRepo.findByUserAndDate(userId, date);
    if (plans.length === 0) {
      throw validationError(
        'NOT_FOUND',
        `No schedule plan found for date ${date}`,
        'date',
        'No plan exists for this date',
        date,
      );
    }
    const latest = plans.sort((a, b) => b.version - a.version)[0];
    const blocks = await this.blockRepo.findByPlan(latest.id);
    return { ...latest, blocks };
  }

  /**
   * Get schedule plans for 7 consecutive days starting from startDate.
   */
  async getWeekPlan(userId: string, startDate: string): Promise<SchedulePlan[]> {
    const plans: SchedulePlan[] = [];
    const start = new Date(startDate);

    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];

      try {
        const plan = await this.getSchedulePlan(userId, dateStr);
        plans.push(plan);
      } catch {
        // No plan for this date — skip
      }
    }

    return plans;
  }

  /**
   * Get the explanation for a specific schedule block.
   * Requirement 9.2
   */
  async getExplanation(blockId: string): Promise<Explanation> {
    const explanation = await this.explanationRepo.findByBlock(blockId);
    if (!explanation) {
      throw validationError(
        'NOT_FOUND',
        `Explanation not found for block ${blockId}`,
        'blockId',
        'No explanation exists for this block',
        blockId,
      );
    }
    return explanation;
  }
}
