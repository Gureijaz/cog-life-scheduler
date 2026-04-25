// Engine types for Cog Life Scheduler

import type {
  Assignment,
  Explanation,
  FixedEvent,
  FlexibleTask,
  PreferenceProfile,
  ScheduleBlock,
  SchedulePlan,
  TravelRule,
} from './domain';

export interface ScheduleInput {
  date: string;                        // ISO date
  fixedEvents: FixedEvent[];
  flexibleTasks: FlexibleTask[];
  assignments: Assignment[];
  travelRules: TravelRule[];
  preferences: PreferenceProfile;
  lockedBlocks: ScheduleBlock[];
}

export interface ScheduleResult {
  plan: SchedulePlan;
  unscheduledItems: UnscheduledItem[];
  explanations: Map<string, Explanation>; // blockId -> explanation
  atRiskAssignments: AtRiskAssignment[];
}

export interface RepairResult extends ScheduleResult {
  changeSummary: ChangeSummary;
}

export interface ChangeSummary {
  moved: { blockId: string; oldStart: string; newStart: string }[];
  added: string[];   // blockIds
  removed: string[]; // blockIds
}

export interface ScheduleChange {
  type: 'add' | 'modify' | 'remove';
  sourceType: 'fixed_event' | 'flexible_task' | 'assignment';
  sourceId?: string;
  date: string;  // ISO date
  details?: Record<string, unknown>;
}

export interface UnscheduledItem {
  sourceType: 'flexible_task' | 'assignment';
  sourceId: string;
  title: string;
  reason: string;
}

export interface ConflictWarning {
  existingEventId: string;
  existingEventTitle: string;
  overlapStart: string;
  overlapEnd: string;
}

export interface AtRiskAssignment {
  assignmentId: string;
  title: string;
  deadline: Date;
  remainingMinutes: number;
  availableMinutes: number;
  shortfallMinutes: number;
}
