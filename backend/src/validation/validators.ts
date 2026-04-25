import type {
  CreateFixedEventInput,
  CreateFlexibleTaskInput,
  CreateAssignmentInput,
  UpdatePreferencesInput,
  UpdateProgressInput,
  ErrorResponse,
} from '../types';

/**
 * Creates a structured validation error matching the ErrorResponse format.
 */
export function validationError(
  code: string,
  message: string,
  field?: string,
  reason?: string,
  value?: unknown
): ErrorResponse {
  return {
    error: {
      code,
      message,
      details: { field, reason, value },
    },
  };
}

/**
 * Parses an "HH:mm" string into total minutes since midnight.
 * Returns null if the format is invalid.
 */
export function parseTime(time: string): number | null {
  // Accept HH:mm or HH:mm:ss (PostgreSQL TIME format)
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Validates a wake/sleep time pair.
 *
 * The wake time must be logically before the sleep time within the same waking day.
 * Overnight sleep is supported: e.g. wake 07:00, sleep 01:00 means the user is
 * awake from 07:00 to 01:00 the next day (18 hours awake).
 *
 * The only invalid case is when wake === sleep (zero-length waking day).
 */
export function validateWakeSleepTimes(
  wakeTime: string,
  sleepTime: string
): ErrorResponse | null {
  const wake = parseTime(wakeTime);
  if (wake === null) {
    return validationError(
      'INVALID_SLEEP_SCHEDULE',
      'Wake time must be in HH:mm format',
      'wakeTime',
      'Invalid time format',
      wakeTime
    );
  }

  const sleep = parseTime(sleepTime);
  if (sleep === null) {
    return validationError(
      'INVALID_SLEEP_SCHEDULE',
      'Sleep time must be in HH:mm format',
      'sleepTime',
      'Invalid time format',
      sleepTime
    );
  }

  if (wake === sleep) {
    return validationError(
      'INVALID_SLEEP_SCHEDULE',
      'Wake time and sleep time cannot be the same',
      'wakeTime',
      'Wake time must differ from sleep time',
      wakeTime
    );
  }

  return null;
}


/**
 * Validates a fixed event time range.
 * End time must be strictly after start time.
 */
export function validateFixedEventTimes(
  startTime: string,
  endTime: string
): ErrorResponse | null {
  const start = parseTime(startTime);
  if (start === null) {
    return validationError(
      'INVALID_TIME_RANGE',
      'Start time must be in HH:mm format',
      'startTime',
      'Invalid time format',
      startTime
    );
  }

  const end = parseTime(endTime);
  if (end === null) {
    return validationError(
      'INVALID_TIME_RANGE',
      'End time must be in HH:mm format',
      'endTime',
      'Invalid time format',
      endTime
    );
  }

  if (end <= start) {
    return validationError(
      'INVALID_TIME_RANGE',
      'End time must be after start time',
      'endTime',
      'End time must be strictly after start time',
      endTime
    );
  }

  return null;
}

/**
 * Validates a fixed event input.
 */
export function validateFixedEventInput(
  input: CreateFixedEventInput
): ErrorResponse | null {
  if (!input.title || input.title.trim() === '') {
    return validationError(
      'VALIDATION_ERROR',
      'Title is required',
      'title',
      'Title must not be empty',
      input.title
    );
  }

  return validateFixedEventTimes(input.startTime, input.endTime);
}

/**
 * Validates flexible task fields.
 * - estimatedMinutes must be > 0
 * - minSessionMinutes (if provided) must be <= estimatedMinutes
 * - dueDate (if provided) must not be in the past
 */
export function validateFlexibleTaskInput(
  input: CreateFlexibleTaskInput,
  now?: Date
): ErrorResponse | null {
  if (!input.title || input.title.trim() === '') {
    return validationError(
      'VALIDATION_ERROR',
      'Title is required',
      'title',
      'Title must not be empty',
      input.title
    );
  }

  if (input.estimatedMinutes <= 0) {
    return validationError(
      'INVALID_DURATION',
      'Estimated duration must be greater than zero',
      'estimatedMinutes',
      'Duration must be > 0',
      input.estimatedMinutes
    );
  }

  if (
    input.minSessionMinutes !== undefined &&
    input.minSessionMinutes > input.estimatedMinutes
  ) {
    return validationError(
      'INVALID_SESSION_LENGTH',
      'Minimum session length cannot exceed estimated duration',
      'minSessionMinutes',
      'Min session cannot exceed total duration',
      input.minSessionMinutes
    );
  }

  if (input.dueDate) {
    const currentDate = now ?? new Date();
    const today = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate()
    );
    const due = new Date(input.dueDate + 'T00:00:00');
    if (due < today) {
      return validationError(
        'PAST_DUE_DATE',
        'Due date must not be in the past',
        'dueDate',
        'Due date must be in the future',
        input.dueDate
      );
    }
  }

  return null;
}

/**
 * Validates assignment fields.
 * - estimatedTotalMinutes must be > 0
 * - progressPercent must be 0-100
 * - deadline must not be in the past
 */
export function validateAssignmentInput(
  input: CreateAssignmentInput,
  now?: Date
): ErrorResponse | null {
  if (!input.title || input.title.trim() === '') {
    return validationError(
      'VALIDATION_ERROR',
      'Title is required',
      'title',
      'Title must not be empty',
      input.title
    );
  }

  if (input.estimatedTotalMinutes <= 0) {
    return validationError(
      'INVALID_DURATION',
      'Estimated total minutes must be greater than zero',
      'estimatedTotalMinutes',
      'Duration must be > 0',
      input.estimatedTotalMinutes
    );
  }

  if (input.progressPercent !== undefined) {
    if (input.progressPercent < 0 || input.progressPercent > 100) {
      return validationError(
        'INVALID_PROGRESS',
        'Progress must be between 0 and 100',
        'progressPercent',
        'Progress must be between 0 and 100',
        input.progressPercent
      );
    }
  }

  const currentDate = now ?? new Date();
  const deadline = new Date(input.deadline);
  if (deadline < currentDate) {
    return validationError(
      'PAST_DUE_DATE',
      'Deadline must not be in the past',
      'deadline',
      'Deadline must be in the future',
      input.deadline
    );
  }

  return null;
}

/**
 * Validates progress update input (0-100 range).
 */
export function validateProgressInput(
  input: UpdateProgressInput
): ErrorResponse | null {
  if (input.progressPercent < 0 || input.progressPercent > 100) {
    return validationError(
      'INVALID_PROGRESS',
      'Progress must be between 0 and 100',
      'progressPercent',
      'Progress must be between 0 and 100',
      input.progressPercent
    );
  }
  return null;
}

/**
 * Validates preference profile fields.
 * - minBufferMinutes must be >= 0
 * - wake/sleep times validated if both provided
 */
export function validatePreferencesInput(
  input: UpdatePreferencesInput
): ErrorResponse | null {
  if (input.wakeTime && input.sleepTime) {
    const err = validateWakeSleepTimes(input.wakeTime, input.sleepTime);
    if (err) return err;
  }

  if (input.wakeTime && !input.sleepTime) {
    if (parseTime(input.wakeTime) === null) {
      return validationError(
        'INVALID_SLEEP_SCHEDULE',
        'Wake time must be in HH:mm format',
        'wakeTime',
        'Invalid time format',
        input.wakeTime
      );
    }
  }

  if (input.sleepTime && !input.wakeTime) {
    if (parseTime(input.sleepTime) === null) {
      return validationError(
        'INVALID_SLEEP_SCHEDULE',
        'Sleep time must be in HH:mm format',
        'sleepTime',
        'Invalid time format',
        input.sleepTime
      );
    }
  }

  if (input.minBufferMinutes !== undefined && input.minBufferMinutes < 0) {
    return validationError(
      'INVALID_BUFFER',
      'Minimum buffer minutes must be greater than or equal to zero',
      'minBufferMinutes',
      'Min buffer must be >= 0',
      input.minBufferMinutes
    );
  }

  return null;
}
