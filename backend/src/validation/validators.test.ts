import { describe, it, expect } from 'vitest';
import {
  parseTime,
  validateWakeSleepTimes,
  validateFixedEventTimes,
  validateFixedEventInput,
  validateFlexibleTaskInput,
  validateAssignmentInput,
  validateProgressInput,
  validatePreferencesInput,
} from './validators';

describe('parseTime', () => {
  it('parses valid HH:mm strings', () => {
    expect(parseTime('00:00')).toBe(0);
    expect(parseTime('07:30')).toBe(450);
    expect(parseTime('23:59')).toBe(1439);
  });

  it('returns null for invalid formats', () => {
    expect(parseTime('7:30')).toBeNull();
    expect(parseTime('25:00')).toBeNull();
    expect(parseTime('12:60')).toBeNull();
    expect(parseTime('abc')).toBeNull();
    expect(parseTime('')).toBeNull();
  });
});

describe('validateWakeSleepTimes', () => {
  it('accepts normal daytime wake/sleep pair', () => {
    expect(validateWakeSleepTimes('07:00', '23:00')).toBeNull();
  });

  it('accepts overnight sleep pattern (sleep before wake numerically)', () => {
    expect(validateWakeSleepTimes('07:00', '01:00')).toBeNull();
  });

  it('rejects identical wake and sleep times', () => {
    const err = validateWakeSleepTimes('08:00', '08:00');
    expect(err).not.toBeNull();
    expect(err!.error.code).toBe('INVALID_SLEEP_SCHEDULE');
  });

  it('rejects invalid time format', () => {
    const err = validateWakeSleepTimes('bad', '23:00');
    expect(err).not.toBeNull();
    expect(err!.error.code).toBe('INVALID_SLEEP_SCHEDULE');
    expect(err!.error.details?.field).toBe('wakeTime');
  });
});

describe('validateFixedEventTimes', () => {
  it('accepts end after start', () => {
    expect(validateFixedEventTimes('09:00', '10:00')).toBeNull();
  });

  it('rejects end equal to start', () => {
    const err = validateFixedEventTimes('09:00', '09:00');
    expect(err).not.toBeNull();
    expect(err!.error.code).toBe('INVALID_TIME_RANGE');
  });

  it('rejects end before start', () => {
    const err = validateFixedEventTimes('10:00', '09:00');
    expect(err).not.toBeNull();
    expect(err!.error.code).toBe('INVALID_TIME_RANGE');
  });
});

describe('validateFixedEventInput', () => {
  it('accepts valid input', () => {
    expect(
      validateFixedEventInput({
        title: 'Meeting',
        eventDate: '2025-12-01',
        startTime: '09:00',
        endTime: '10:00',
        category: 'work',
      })
    ).toBeNull();
  });

  it('rejects empty title', () => {
    const err = validateFixedEventInput({
      title: '',
      eventDate: '2025-12-01',
      startTime: '09:00',
      endTime: '10:00',
      category: 'work',
    });
    expect(err).not.toBeNull();
    expect(err!.error.code).toBe('VALIDATION_ERROR');
    expect(err!.error.details?.field).toBe('title');
  });
});


describe('validateFlexibleTaskInput', () => {
  const futureDate = '2099-12-31';

  it('accepts valid input', () => {
    expect(
      validateFlexibleTaskInput({
        title: 'Study',
        category: 'academic',
        estimatedMinutes: 60,
        minSessionMinutes: 30,
        dueDate: futureDate,
      })
    ).toBeNull();
  });

  it('rejects zero duration', () => {
    const err = validateFlexibleTaskInput({
      title: 'Study',
      category: 'academic',
      estimatedMinutes: 0,
    });
    expect(err).not.toBeNull();
    expect(err!.error.code).toBe('INVALID_DURATION');
  });

  it('rejects negative duration', () => {
    const err = validateFlexibleTaskInput({
      title: 'Study',
      category: 'academic',
      estimatedMinutes: -10,
    });
    expect(err).not.toBeNull();
    expect(err!.error.code).toBe('INVALID_DURATION');
  });

  it('rejects minSession > estimatedMinutes', () => {
    const err = validateFlexibleTaskInput({
      title: 'Study',
      category: 'academic',
      estimatedMinutes: 30,
      minSessionMinutes: 60,
    });
    expect(err).not.toBeNull();
    expect(err!.error.code).toBe('INVALID_SESSION_LENGTH');
  });

  it('accepts minSession equal to estimatedMinutes', () => {
    expect(
      validateFlexibleTaskInput({
        title: 'Study',
        category: 'academic',
        estimatedMinutes: 30,
        minSessionMinutes: 30,
      })
    ).toBeNull();
  });

  it('rejects past due date', () => {
    const err = validateFlexibleTaskInput(
      {
        title: 'Study',
        category: 'academic',
        estimatedMinutes: 60,
        dueDate: '2020-01-01',
      },
      new Date('2025-06-01')
    );
    expect(err).not.toBeNull();
    expect(err!.error.code).toBe('PAST_DUE_DATE');
  });

  it('accepts today as due date', () => {
    const now = new Date('2025-06-15T14:00:00');
    expect(
      validateFlexibleTaskInput(
        {
          title: 'Study',
          category: 'academic',
          estimatedMinutes: 60,
          dueDate: '2025-06-15',
        },
        now
      )
    ).toBeNull();
  });
});

describe('validateAssignmentInput', () => {
  const futureDeadline = '2099-12-31T23:59:00Z';

  it('accepts valid input', () => {
    expect(
      validateAssignmentInput({
        title: 'Essay',
        subject: 'English',
        deadline: futureDeadline,
        estimatedTotalMinutes: 120,
        progressPercent: 50,
      })
    ).toBeNull();
  });

  it('rejects zero duration', () => {
    const err = validateAssignmentInput({
      title: 'Essay',
      subject: 'English',
      deadline: futureDeadline,
      estimatedTotalMinutes: 0,
    });
    expect(err).not.toBeNull();
    expect(err!.error.code).toBe('INVALID_DURATION');
  });

  it('rejects progress > 100', () => {
    const err = validateAssignmentInput({
      title: 'Essay',
      subject: 'English',
      deadline: futureDeadline,
      estimatedTotalMinutes: 120,
      progressPercent: 101,
    });
    expect(err).not.toBeNull();
    expect(err!.error.code).toBe('INVALID_PROGRESS');
  });

  it('rejects negative progress', () => {
    const err = validateAssignmentInput({
      title: 'Essay',
      subject: 'English',
      deadline: futureDeadline,
      estimatedTotalMinutes: 120,
      progressPercent: -1,
    });
    expect(err).not.toBeNull();
    expect(err!.error.code).toBe('INVALID_PROGRESS');
  });

  it('rejects past deadline', () => {
    const err = validateAssignmentInput(
      {
        title: 'Essay',
        subject: 'English',
        deadline: '2020-01-01T00:00:00Z',
        estimatedTotalMinutes: 120,
      },
      new Date('2025-06-01')
    );
    expect(err).not.toBeNull();
    expect(err!.error.code).toBe('PAST_DUE_DATE');
  });
});

describe('validateProgressInput', () => {
  it('accepts 0', () => {
    expect(validateProgressInput({ progressPercent: 0 })).toBeNull();
  });

  it('accepts 100', () => {
    expect(validateProgressInput({ progressPercent: 100 })).toBeNull();
  });

  it('accepts 50', () => {
    expect(validateProgressInput({ progressPercent: 50 })).toBeNull();
  });

  it('rejects -1', () => {
    const err = validateProgressInput({ progressPercent: -1 });
    expect(err).not.toBeNull();
    expect(err!.error.code).toBe('INVALID_PROGRESS');
  });

  it('rejects 101', () => {
    const err = validateProgressInput({ progressPercent: 101 });
    expect(err).not.toBeNull();
    expect(err!.error.code).toBe('INVALID_PROGRESS');
  });
});

describe('validatePreferencesInput', () => {
  it('accepts valid preferences', () => {
    expect(
      validatePreferencesInput({
        wakeTime: '07:00',
        sleepTime: '23:00',
        minBufferMinutes: 5,
      })
    ).toBeNull();
  });

  it('accepts zero buffer', () => {
    expect(
      validatePreferencesInput({ minBufferMinutes: 0 })
    ).toBeNull();
  });

  it('rejects negative buffer', () => {
    const err = validatePreferencesInput({ minBufferMinutes: -5 });
    expect(err).not.toBeNull();
    expect(err!.error.code).toBe('INVALID_BUFFER');
    expect(err!.error.details?.field).toBe('minBufferMinutes');
    expect(err!.error.details?.value).toBe(-5);
  });

  it('validates wake/sleep when both provided', () => {
    const err = validatePreferencesInput({
      wakeTime: '08:00',
      sleepTime: '08:00',
    });
    expect(err).not.toBeNull();
    expect(err!.error.code).toBe('INVALID_SLEEP_SCHEDULE');
  });

  it('validates wake time format when only wake provided', () => {
    const err = validatePreferencesInput({ wakeTime: 'bad' });
    expect(err).not.toBeNull();
    expect(err!.error.code).toBe('INVALID_SLEEP_SCHEDULE');
  });

  it('accepts valid wake time alone', () => {
    expect(validatePreferencesInput({ wakeTime: '07:00' })).toBeNull();
  });
});
