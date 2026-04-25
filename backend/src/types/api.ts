// API types for Cog Life Scheduler

import type {
  EnergyLevel,
  FixedEvent,
  FlexibleTask,
  Assignment,
  Priority,
  TimeWindow,
} from './domain';
import type { ScheduleChange } from './engine';

// --- Error Response ---

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: {
      field?: string;
      reason?: string;
      value?: unknown;
    };
  };
}

// --- AI Response ---

export interface AIResponse {
  intent: 'create' | 'edit' | 'delete' | 'reschedule' | 'explain' | 'unknown';
  extractedFields?: Partial<FixedEvent | FlexibleTask | Assignment>;
  targetItemId?: string;
  proposedChanges?: ScheduleChange;
  followUpQuestion?: string;
  explanation?: string;
  confirmationRequired: boolean;
  summary: string;
}

// --- User DTOs ---

export interface CreateUserInput {
  name: string;
  email: string;
  timezone?: string;
}

export interface UpdatePreferencesInput {
  wakeTime?: string;
  sleepTime?: string;
  focusWindows?: TimeWindow[];
  workoutWindows?: TimeWindow[];
  minBufferMinutes?: number;
  maxDeepWorkMinutes?: number;
  defaultCommuteMinutes?: number;
  autoRepairEnabled?: boolean;
}

// --- Fixed Event DTOs ---

export interface CreateFixedEventInput {
  title: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  locationId?: string | null;
  recurrenceRule?: string | null;
  category: string;
  notes?: string | null;
}

// --- Flexible Task DTOs ---

export interface CreateFlexibleTaskInput {
  title: string;
  category: string;
  estimatedMinutes: number;
  minSessionMinutes?: number;
  priority?: Priority;
  dueDate?: string | null;
  energyRequirement?: EnergyLevel;
  preferredWindow?: TimeWindow | null;
}

// --- Assignment DTOs ---

export interface CreateAssignmentInput {
  title: string;
  subject: string;
  deadline: string;  // ISO datetime
  estimatedTotalMinutes: number;
  progressPercent?: number;
}

export interface UpdateProgressInput {
  progressPercent: number;
}

// --- Location DTOs ---

export interface CreateLocationInput {
  name: string;
  label: string;
  type: string;
}

// --- Travel Rule DTOs ---

export interface CreateTravelRuleInput {
  originId: string;
  destinationId: string;
  travelMinutes: number;
}

// --- Schedule DTOs ---

export interface GenerateScheduleInput {
  date: string;  // YYYY-MM-DD
}

export interface RepairScheduleInput {
  change: ScheduleChange;
}

// --- AI Message DTO ---

export interface AIMessageInput {
  message: string;
}
