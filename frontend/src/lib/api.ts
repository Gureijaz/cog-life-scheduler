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
  AIResponse,
  ApiError,
  UnscheduledItem,
  AtRiskAssignment,
  ChangeSummary,
  TimeWindow,
  Priority,
  EnergyLevel,
} from './types';

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/+$/, '');

// --- Request/Response DTOs ---

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

export interface CreateAssignmentInput {
  title: string;
  subject: string;
  deadline: string;
  estimatedTotalMinutes: number;
  progressPercent?: number;
}

export interface CreateLocationInput {
  name: string;
  label: string;
  type: string;
}

export interface CreateTravelRuleInput {
  originId: string;
  destinationId: string;
  travelMinutes: number;
}

export interface ScheduleResult {
  plan: SchedulePlan;
  unscheduledItems: UnscheduledItem[];
  explanations: Record<string, Explanation>;
}

export interface RepairResult extends ScheduleResult {
  changeSummary: ChangeSummary;
}

// --- Fetch helper ---

let currentUserId: string | null = process.env.NEXT_PUBLIC_DEFAULT_USER_ID ?? null;

export function setCurrentUserId(userId: string): void {
  currentUserId = userId;
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

class ApiRequestError extends Error {
  constructor(
    public status: number,
    public body: ApiError,
  ) {
    super(body.error?.message ?? 'API request failed');
    this.name = 'ApiRequestError';
  }
}

export { ApiRequestError };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (currentUserId) {
    headers['x-user-id'] = currentUserId;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json();

  if (!res.ok) {
    throw new ApiRequestError(res.status, body as ApiError);
  }

  return body as T;
}

// --- Users ---

export const users = {
  create(data: CreateUserInput): Promise<User> {
    return request<User>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  get(userId: string): Promise<User> {
    return request<User>(`/api/users/${userId}`);
  },

  updatePreferences(userId: string, prefs: UpdatePreferencesInput): Promise<PreferenceProfile> {
    return request<PreferenceProfile>(`/api/users/${userId}/preferences`, {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
  },
};

// --- Fixed Events ---

export const fixedEvents = {
  create(data: CreateFixedEventInput): Promise<FixedEvent> {
    return request<FixedEvent>('/api/fixed-events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  list(date: string): Promise<FixedEvent[]> {
    return request<FixedEvent[]>(`/api/fixed-events?date=${encodeURIComponent(date)}`);
  },

  update(eventId: string, data: Partial<FixedEvent>): Promise<FixedEvent> {
    return request<FixedEvent>(`/api/fixed-events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  updateInstance(eventId: string, date: string, data: Partial<FixedEvent>): Promise<FixedEvent> {
    return request<FixedEvent>(`/api/fixed-events/${eventId}/instances/${date}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete(eventId: string): Promise<void> {
    return request<void>(`/api/fixed-events/${eventId}`, {
      method: 'DELETE',
    });
  },
};

// --- Flexible Tasks ---

export const flexibleTasks = {
  create(data: CreateFlexibleTaskInput): Promise<FlexibleTask> {
    return request<FlexibleTask>('/api/flexible-tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  list(): Promise<FlexibleTask[]> {
    return request<FlexibleTask[]>('/api/flexible-tasks');
  },

  update(taskId: string, data: Partial<FlexibleTask>): Promise<FlexibleTask> {
    return request<FlexibleTask>(`/api/flexible-tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete(taskId: string): Promise<void> {
    return request<void>(`/api/flexible-tasks/${taskId}`, {
      method: 'DELETE',
    });
  },
};

// --- Assignments ---

export const assignments = {
  create(data: CreateAssignmentInput): Promise<Assignment> {
    return request<Assignment>('/api/assignments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  list(): Promise<Assignment[]> {
    return request<Assignment[]>('/api/assignments');
  },

  update(assignmentId: string, data: Partial<Assignment>): Promise<Assignment> {
    return request<Assignment>(`/api/assignments/${assignmentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  updateProgress(assignmentId: string, progressPercent: number): Promise<Assignment> {
    return request<Assignment>(`/api/assignments/${assignmentId}/progress`, {
      method: 'PUT',
      body: JSON.stringify({ progressPercent }),
    });
  },
};

// --- Locations ---

export const locations = {
  create(data: CreateLocationInput): Promise<Location> {
    return request<Location>('/api/locations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// --- Travel Rules ---

export const travelRules = {
  create(data: CreateTravelRuleInput): Promise<TravelRule> {
    return request<TravelRule>('/api/travel-rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  list(): Promise<TravelRule[]> {
    return request<TravelRule[]>('/api/travel-rules');
  },

  update(ruleId: string, travelMinutes: number): Promise<TravelRule> {
    return request<TravelRule>(`/api/travel-rules/${ruleId}`, {
      method: 'PUT',
      body: JSON.stringify({ travelMinutes }),
    });
  },
};

// --- Schedules ---

export const schedules = {
  generate(date: string): Promise<ScheduleResult> {
    return request<ScheduleResult>('/api/schedules/generate', {
      method: 'POST',
      body: JSON.stringify({ date }),
    });
  },

  repair(planId: string, change: unknown): Promise<RepairResult> {
    return request<RepairResult>(`/api/schedules/${planId}/repair`, {
      method: 'POST',
      body: JSON.stringify({ change }),
    });
  },

  get(date: string): Promise<SchedulePlan> {
    return request<SchedulePlan>(`/api/schedules?date=${encodeURIComponent(date)}`);
  },

  getWeek(startDate: string): Promise<SchedulePlan[]> {
    return request<SchedulePlan[]>(`/api/schedules/week?start=${encodeURIComponent(startDate)}`);
  },
};

// --- Schedule Blocks ---

export const scheduleBlocks = {
  lock(blockId: string): Promise<ScheduleBlock> {
    return request<ScheduleBlock>(`/api/schedule-blocks/${blockId}/lock`, {
      method: 'PUT',
    });
  },

  unlock(blockId: string): Promise<ScheduleBlock> {
    return request<ScheduleBlock>(`/api/schedule-blocks/${blockId}/unlock`, {
      method: 'PUT',
    });
  },

  getExplanation(blockId: string): Promise<Explanation> {
    return request<Explanation>(`/api/schedule-blocks/${blockId}/explanation`);
  },
};

// --- AI Assistant ---

export const ai = {
  sendMessage(message: string): Promise<AIResponse> {
    return request<AIResponse>('/api/ai/message', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },
};
