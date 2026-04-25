// Typed entity repositories
// Requirements: 12.1, 12.2, 12.4

import { Pool } from 'pg';
import type {
  User,
  PreferenceProfile,
  FixedEvent,
  FlexibleTask,
  Assignment,
  Location,
  TravelRule,
  SchedulePlan,
  ScheduleBlock,
  Explanation,
} from '../types/domain';
import { Repository, buildColumnMapping } from './base';

// ── User ──────────────────────────────────────────────────────

const userColumns = buildColumnMapping([
  'id', 'name', 'email', 'timezone', 'onboardingComplete', 'createdAt', 'updatedAt',
]);

export class UserRepository extends Repository<User> {
  constructor(pool: Pool) {
    super(pool, 'users', userColumns);
  }
}

// ── PreferenceProfile ─────────────────────────────────────────

const preferenceColumns = buildColumnMapping([
  'id', 'userId', 'wakeTime', 'sleepTime', 'focusWindows', 'workoutWindows',
  'minBufferMinutes', 'maxDeepWorkMinutes', 'defaultCommuteMinutes',
  'autoRepairEnabled', 'updatedAt',
]);

export class PreferenceProfileRepository extends Repository<PreferenceProfile> {
  constructor(pool: Pool) {
    super(pool, 'preference_profiles', preferenceColumns);
  }

  async findByUserId(userId: string): Promise<PreferenceProfile | null> {
    const results = await this.findMany({ userId });
    return results[0] ?? null;
  }
}

// ── FixedEvent ────────────────────────────────────────────────

const fixedEventColumns = buildColumnMapping([
  'id', 'userId', 'title', 'eventDate', 'startTime', 'endTime',
  'locationId', 'recurrenceRule', 'recurrenceParentId', 'category', 'notes', 'createdAt',
]);

export class FixedEventRepository extends Repository<FixedEvent> {
  constructor(pool: Pool) {
    super(pool, 'fixed_events', fixedEventColumns);
  }

  async findByUserAndDate(userId: string, date: string): Promise<FixedEvent[]> {
    return this.findMany({ userId, eventDate: date });
  }
}

// ── FlexibleTask ──────────────────────────────────────────────

const flexibleTaskColumns = buildColumnMapping([
  'id', 'userId', 'title', 'category', 'estimatedMinutes', 'minSessionMinutes',
  'priority', 'dueDate', 'energyRequirement', 'preferredWindow', 'remainingMinutes', 'createdAt',
]);

export class FlexibleTaskRepository extends Repository<FlexibleTask> {
  constructor(pool: Pool) {
    super(pool, 'flexible_tasks', flexibleTaskColumns);
  }

  async findByUser(userId: string): Promise<FlexibleTask[]> {
    return this.findMany({ userId });
  }
}

// ── Assignment ────────────────────────────────────────────────

const assignmentColumns = buildColumnMapping([
  'id', 'userId', 'title', 'subject', 'deadline', 'estimatedTotalMinutes',
  'progressPercent', 'urgencyScore', 'remainingMinutes', 'createdAt',
]);

export class AssignmentRepository extends Repository<Assignment> {
  constructor(pool: Pool) {
    super(pool, 'assignments', assignmentColumns);
  }

  async findByUser(userId: string): Promise<Assignment[]> {
    return this.findMany({ userId });
  }
}

// ── Location ──────────────────────────────────────────────────

const locationColumns = buildColumnMapping([
  'id', 'userId', 'name', 'label', 'type',
]);

export class LocationRepository extends Repository<Location> {
  constructor(pool: Pool) {
    super(pool, 'locations', locationColumns);
  }

  async findByUser(userId: string): Promise<Location[]> {
    return this.findMany({ userId });
  }
}

// ── TravelRule ────────────────────────────────────────────────

const travelRuleColumns = buildColumnMapping([
  'id', 'userId', 'originId', 'destinationId', 'travelMinutes',
]);

export class TravelRuleRepository extends Repository<TravelRule> {
  constructor(pool: Pool) {
    super(pool, 'travel_rules', travelRuleColumns);
  }

  async findByUser(userId: string): Promise<TravelRule[]> {
    return this.findMany({ userId });
  }
}

// ── SchedulePlan ──────────────────────────────────────────────

const schedulePlanColumns = buildColumnMapping([
  'id', 'userId', 'planDate', 'version', 'generatedAt',
]);

export class SchedulePlanRepository extends Repository<SchedulePlan> {
  constructor(pool: Pool) {
    super(pool, 'schedule_plans', schedulePlanColumns);
  }

  async findByUserAndDate(userId: string, date: string): Promise<SchedulePlan[]> {
    return this.findMany({ userId, planDate: date });
  }
}

// ── ScheduleBlock ─────────────────────────────────────────────

const scheduleBlockColumns = buildColumnMapping([
  'id', 'planId', 'sourceType', 'sourceId', 'title',
  'startTime', 'endTime', 'locationId', 'locked', 'sortOrder',
]);

export class ScheduleBlockRepository extends Repository<ScheduleBlock> {
  constructor(pool: Pool) {
    super(pool, 'schedule_blocks', scheduleBlockColumns);
  }

  async findByPlan(planId: string): Promise<ScheduleBlock[]> {
    return this.findMany({ planId });
  }
}

// ── Explanation ───────────────────────────────────────────────

const explanationColumns = buildColumnMapping([
  'id', 'blockId', 'explanationText', 'referencedConstraints', 'createdAt',
]);

export class ExplanationRepository extends Repository<Explanation> {
  constructor(pool: Pool) {
    super(pool, 'explanations', explanationColumns);
  }

  async findByBlock(blockId: string): Promise<Explanation | null> {
    const results = await this.findMany({ blockId });
    return results[0] ?? null;
  }
}
