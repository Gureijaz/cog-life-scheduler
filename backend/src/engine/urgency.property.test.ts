import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeUrgency } from './urgency';
import type { Assignment } from '../types/domain';

/**
 * Helper to build an Assignment with sensible defaults and overrides.
 */
function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: 'a1',
    userId: 'u1',
    title: 'Test Assignment',
    subject: 'Math',
    deadline: new Date('2025-06-01T12:00:00Z'),
    estimatedTotalMinutes: 120,
    progressPercent: 0,
    urgencyScore: 0,
    remainingMinutes: 120,
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Arbitrary for a positive number of estimated total minutes (1–2000).
 */
const totalMinutesArb = fc.integer({ min: 1, max: 2000 });

/**
 * Arbitrary for progress percent (0–100).
 */
const progressArb = fc.integer({ min: 0, max: 100 });

/**
 * Arbitrary for a "now" timestamp and a deadline that is strictly in the future
 * relative to "now". Both are within a reasonable date range.
 */
const nowAndFutureDeadlineArb = fc
  .record({
    nowMs: fc.integer({
      min: new Date('2024-01-01').getTime(),
      max: new Date('2026-01-01').getTime(),
    }),
    gapMinutes: fc.integer({ min: 1, max: 525_600 }), // 1 min to ~1 year
  })
  .map(({ nowMs, gapMinutes }) => ({
    now: new Date(nowMs),
    deadline: new Date(nowMs + gapMinutes * 60_000),
  }));

describe('Property 10: Urgency Score Computation', () => {
  /**
   * **Validates: Requirements 4.2, 4.6**
   *
   * For any Assignment with known remaining minutes, total minutes, progress
   * percentage, and time until deadline, the computed urgency score SHALL equal
   * remainingMinutes / minutesUntilDeadline (clamped to [0, 1]), and updating
   * the progress percentage SHALL correctly recalculate remaining minutes as
   * totalMinutes × (1 − progressPercent / 100) and recompute the urgency score.
   */
  it('urgency score equals remainingMinutes / minutesUntilDeadline clamped to [0, 1]', () => {
    fc.assert(
      fc.property(
        totalMinutesArb,
        progressArb,
        nowAndFutureDeadlineArb,
        (totalMinutes, progressPercent, { now, deadline }) => {
          const assignment = makeAssignment({
            estimatedTotalMinutes: totalMinutes,
            progressPercent,
            deadline,
          });

          const score = computeUrgency(assignment, now);

          const remainingMinutes = totalMinutes * (1 - progressPercent / 100);

          if (remainingMinutes <= 0) {
            // Zero remaining work → score 0
            expect(score).toBe(0);
          } else {
            const minutesUntilDeadline =
              (deadline.getTime() - now.getTime()) / 60_000;
            const expectedRaw = remainingMinutes / minutesUntilDeadline;
            const expected = Math.min(Math.max(expectedRaw, 0), 1);

            expect(score).toBeCloseTo(expected, 10);
          }

          // Score is always in [0, 1]
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('progress updates correctly recalculate remaining minutes and urgency', () => {
    fc.assert(
      fc.property(
        totalMinutesArb,
        progressArb,
        progressArb,
        nowAndFutureDeadlineArb,
        (totalMinutes, progress1, progress2, { now, deadline }) => {
          const assignment1 = makeAssignment({
            estimatedTotalMinutes: totalMinutes,
            progressPercent: progress1,
            deadline,
          });
          const assignment2 = makeAssignment({
            estimatedTotalMinutes: totalMinutes,
            progressPercent: progress2,
            deadline,
          });

          const score1 = computeUrgency(assignment1, now);
          const score2 = computeUrgency(assignment2, now);

          const remaining1 = totalMinutes * (1 - progress1 / 100);
          const remaining2 = totalMinutes * (1 - progress2 / 100);

          // Higher progress → less remaining work → lower or equal urgency
          if (progress2 > progress1) {
            expect(remaining2).toBeLessThan(remaining1);
            expect(score2).toBeLessThanOrEqual(score1 + 1e-9);
          }

          // Both scores must be in [0, 1]
          expect(score1).toBeGreaterThanOrEqual(0);
          expect(score1).toBeLessThanOrEqual(1);
          expect(score2).toBeGreaterThanOrEqual(0);
          expect(score2).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('deadline passed yields score 1.0 when remaining work exists', () => {
    fc.assert(
      fc.property(
        totalMinutesArb,
        fc.integer({ min: 0, max: 99 }), // progress < 100 so remaining > 0
        (totalMinutes, progressPercent) => {
          const now = new Date('2025-06-15T00:00:00Z');
          const deadline = new Date('2025-06-14T00:00:00Z'); // in the past

          const assignment = makeAssignment({
            estimatedTotalMinutes: totalMinutes,
            progressPercent,
            deadline,
          });

          expect(computeUrgency(assignment, now)).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('zero remaining work yields score 0 regardless of deadline', () => {
    fc.assert(
      fc.property(
        totalMinutesArb,
        fc.date({ min: new Date('2024-01-01'), max: new Date('2026-01-01') }),
        fc.date({ min: new Date('2024-01-01'), max: new Date('2026-01-01') }),
        (totalMinutes, now, deadline) => {
          const assignment = makeAssignment({
            estimatedTotalMinutes: totalMinutes,
            progressPercent: 100,
            deadline,
          });

          expect(computeUrgency(assignment, now)).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('Property 11: Urgency Score Monotonicity', () => {
  /**
   * **Validates: Requirements 4.3**
   *
   * For any Assignment with constant remaining work, computing the urgency
   * score at two different times t1 and t2 where t1 < t2 (both before
   * deadline) SHALL produce urgencyScore(t2) >= urgencyScore(t1).
   */
  it('urgency score is non-decreasing as time advances toward deadline', () => {
    fc.assert(
      fc.property(
        totalMinutesArb,
        progressArb,
        fc.record({
          baseMs: fc.integer({
            min: new Date('2024-01-01').getTime(),
            max: new Date('2025-06-01').getTime(),
          }),
          gap1Minutes: fc.integer({ min: 60, max: 525_600 }),
          gap2Minutes: fc.integer({ min: 1, max: 525_599 }),
        }),
        (totalMinutes, progressPercent, { baseMs, gap1Minutes, gap2Minutes }) => {
          // Ensure t1 < t2 < deadline
          // t1 = base, deadline = base + gap1Minutes
          // t2 = t1 + gap2Minutes, but t2 must be before deadline
          const t1 = new Date(baseMs);
          const deadlineMs = baseMs + gap1Minutes * 60_000;
          const deadline = new Date(deadlineMs);

          // t2 must be strictly after t1 and strictly before deadline
          const t2Ms = baseMs + Math.min(gap2Minutes, gap1Minutes - 1) * 60_000;
          if (t2Ms <= baseMs || t2Ms >= deadlineMs) return; // skip invalid combos

          const t2 = new Date(t2Ms);

          const assignment = makeAssignment({
            estimatedTotalMinutes: totalMinutes,
            progressPercent,
            deadline,
          });

          const score1 = computeUrgency(assignment, t1);
          const score2 = computeUrgency(assignment, t2);

          // As time advances (t2 > t1), urgency should not decrease
          expect(score2).toBeGreaterThanOrEqual(score1 - 1e-9);
        }
      ),
      { numRuns: 200 }
    );
  });
});
