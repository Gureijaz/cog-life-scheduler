// Shared TypeScript types mirroring backend domain types

export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type EnergyLevel = 'low' | 'medium' | 'high';
export type SourceType = 'fixed_event' | 'flexible_task' | 'assignment' | 'travel_buffer';
export type TimeWindow = { start: string; end: string }; // HH:mm format

export interface User {
  id: string;
  name: string;
  email: string;
  timezone: string;
  onboardingComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PreferenceProfile {
  id: string;
  userId: string;
  wakeTime: string;       // HH:mm
  sleepTime: string;      // HH:mm
  focusWindows: TimeWindow[];
  workoutWindows: TimeWindow[];
  minBufferMinutes: number;
  maxDeepWorkMinutes: number;
  defaultCommuteMinutes: number;
  autoRepairEnabled: boolean;
  updatedAt: string;
}

export interface FixedEvent {
  id: string;
  userId: string;
  title: string;
  eventDate: string;      // YYYY-MM-DD
  startTime: string;      // HH:mm
  endTime: string;        // HH:mm
  locationId: string | null;
  recurrenceRule: string | null;
  recurrenceParentId: string | null;
  category: string;
  notes: string | null;
  createdAt: string;
}

export interface FlexibleTask {
  id: string;
  userId: string;
  title: string;
  category: string;
  estimatedMinutes: number;
  minSessionMinutes: number;
  priority: Priority;
  dueDate: string | null;  // YYYY-MM-DD
  energyRequirement: EnergyLevel;
  preferredWindow: TimeWindow | null;
  remainingMinutes: number;
  createdAt: string;
}

export interface Assignment {
  id: string;
  userId: string;
  title: string;
  subject: string;
  deadline: string;       // ISO datetime
  estimatedTotalMinutes: number;
  progressPercent: number;
  urgencyScore: number;
  remainingMinutes: number;
  createdAt: string;
}

export interface Location {
  id: string;
  userId: string;
  name: string;
  label: string;
  type: string;
}

export interface TravelRule {
  id: string;
  userId: string;
  originId: string;
  destinationId: string;
  travelMinutes: number;
}

export interface SchedulePlan {
  id: string;
  userId: string;
  planDate: string;       // YYYY-MM-DD
  version: number;
  generatedAt: string;
  blocks: ScheduleBlock[];
}

export interface ScheduleBlock {
  id: string;
  planId: string;
  sourceType: SourceType;
  sourceId: string | null;
  title: string;
  startTime: string;      // HH:mm
  endTime: string;        // HH:mm
  locationId: string | null;
  locked: boolean;
  sortOrder: number;
}

export interface Explanation {
  id: string;
  blockId: string;
  explanationText: string;
  referencedConstraints: string[];
  createdAt: string;
}

// Engine types
export interface UnscheduledItem {
  sourceType: SourceType;
  sourceId: string;
  title: string;
  reason: string;
}

export interface AtRiskAssignment {
  assignmentId: string;
  title: string;
  deadline: string;
  shortfallMinutes: number;
}

export interface ChangeSummary {
  moved: { blockId: string; oldStart: string; newStart: string }[];
  added: string[];
  removed: string[];
}

// API types
export interface AIResponse {
  intent: 'create' | 'edit' | 'delete' | 'reschedule' | 'explain' | 'unknown';
  extractedFields?: Partial<FixedEvent | FlexibleTask | Assignment>;
  targetItemId?: string;
  proposedChanges?: unknown;
  followUpQuestion?: string;
  explanation?: string;
  confirmationRequired: boolean;
  summary: string;
}

export interface ApiError {
  error: string;
  message: string;
  fields?: Record<string, string>;
}
