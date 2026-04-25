import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  parseTime,
  validateWakeSleepTimes,
  validateFixedEventTimes,
  validateFlexibleTaskInput,
} from './validators';

/**
 * Arbitrary that generates valid HH:mm time strings.
 * Hours: 00-23, Minutes: 00-59
 */
const validTimeArb = fc
  .record({
    hours: fc.integer({ min: 0, max: 23 }),
    minutes: fc.integer({ min: 0, max: 59 }),
  })
  .map(({ hours, minutes }) => {
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return hh + ':' + mm;
  });

/**
 * Converts an HH:mm string to total minutes since midnight.
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

describe('Property 1: Wake/Sleep Time Validation', () => {
  /**
   * **Validates: Requirements 1.4**
   *
   * For any pair of wake time and sleep time values, the validation function
   * SHALL accept the pair if and only if the wake time is logically before the
   * sleep time within the same waking day, correctly handling overnight sleep
   * patterns (e.g., wake 07:00, sleep 01:00 next day).
   *
   * The only invalid case is wake === sleep (zero-length waking day).
   */
  it('should accept any valid time pair where wake !== sleep and reject when wake === sleep', () => {
    fc.assert(
      fc.property(validTimeArb, validTimeArb, (wakeTime, sleepTime) => {
        const result = validateWakeSleepTimes(wakeTime, sleepTime);

        if (wakeTime === sleepTime) {
          // Must reject: zero-length waking day
          expect(result).not.toBeNull();
          expect(result!.error.code).toBe('INVALID_SLEEP_SCHEDULE');
        } else {
          // Must accept: any distinct pair is valid (overnight patterns allowed)
          expect(result).toBeNull();
        }
      }),
      { numRuns: 200 }
    );
  });

  it('should always reject invalid time formats', () => {
    fc.assert(
      fc.property(fc.string(), validTimeArb, (badTime, goodTime) => {
        // Skip strings that happen to be valid HH:mm
        if (parseTime(badTime) !== null) return;

        const result = validateWakeSleepTimes(badTime, goodTime);
        expect(result).not.toBeNull();
        expect(result!.error.code).toBe('INVALID_SLEEP_SCHEDULE');
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 2: Fixed Event Time Validation', () => {
  /**
   * **Validates: Requirements 2.2**
   *
   * For any pair of start time and end time for a Fixed_Event, the validation
   * function SHALL accept the pair if and only if end time is strictly after
   * start time.
   */
  it('should accept iff end > start', () => {
    fc.assert(
      fc.property(validTimeArb, validTimeArb, (startTime, endTime) => {
        const result = validateFixedEventTimes(startTime, endTime);
        const startMin = timeToMinutes(startTime);
        const endMin = timeToMinutes(endTime);

        if (endMin > startMin) {
          // Must accept
          expect(result).toBeNull();
        } else {
          // Must reject (end <= start)
          expect(result).not.toBeNull();
          expect(result!.error.code).toBe('INVALID_TIME_RANGE');
        }
      }),
      { numRuns: 200 }
    );
  });

  it('should always reject invalid time formats', () => {
    fc.assert(
      fc.property(fc.string(), validTimeArb, (badTime, goodTime) => {
        if (parseTime(badTime) !== null) return;

        const result = validateFixedEventTimes(badTime, goodTime);
        expect(result).not.toBeNull();
        expect(result!.error.code).toBe('INVALID_TIME_RANGE');
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 7: Task Session/Duration Validation', () => {
  /**
   * **Validates: Requirements 3.3**
   *
   * For any Flexible_Task input, the validation function SHALL reject the task
   * if and only if the minimum session length exceeds the estimated duration.
   */
  it('should reject iff minSessionMinutes > estimatedMinutes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1440 }),
        fc.integer({ min: 1, max: 1440 }),
        (estimatedMinutes, minSessionMinutes) => {
          const input = {
            title: 'Test Task',
            category: 'test',
            estimatedMinutes,
            minSessionMinutes,
          };

          const result = validateFlexibleTaskInput(input);

          if (minSessionMinutes > estimatedMinutes) {
            // Must reject
            expect(result).not.toBeNull();
            expect(result!.error.code).toBe('INVALID_SESSION_LENGTH');
          } else {
            // Must accept (session <= duration)
            expect(result).toBeNull();
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('should accept when minSessionMinutes is not provided regardless of duration', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1440 }),
        (estimatedMinutes) => {
          const input = {
            title: 'Test Task',
            category: 'test',
            estimatedMinutes,
          };

          const result = validateFlexibleTaskInput(input);
          // No minSessionMinutes means no session/duration conflict
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
