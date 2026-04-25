import type { Assignment } from '../types/domain';

export interface UrgencyCalculator {
  compute(assignment: Assignment, now: Date): number;
}

/**
 * Computes urgency score for an assignment.
 *
 * urgencyScore = remainingMinutes / minutesUntilDeadline, clamped to [0, 1].
 * remainingMinutes = totalMinutes × (1 − progressPercent / 100).
 *
 * Edge cases:
 *  - Deadline already passed → 1.0
 *  - Zero remaining work → 0
 */
export function computeUrgency(assignment: Assignment, now: Date): number {
  const remainingMinutes =
    assignment.estimatedTotalMinutes * (1 - assignment.progressPercent / 100);

  if (remainingMinutes <= 0) return 0;

  const msUntilDeadline = assignment.deadline.getTime() - now.getTime();
  if (msUntilDeadline <= 0) return 1;

  const minutesUntilDeadline = msUntilDeadline / 60_000;
  const score = remainingMinutes / minutesUntilDeadline;

  return Math.min(Math.max(score, 0), 1);
}

export const urgencyCalculator: UrgencyCalculator = {
  compute: computeUrgency,
};
