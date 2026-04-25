import { describe, it, expect } from 'vitest';
import { computeUrgency } from './urgency';
import type { Assignment } from '../types/domain';

function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: 'a1',
    userId: 'u1',
    title: 'Test',
    subject: 'Math',
    deadline: new Date('2025-02-01T12:00:00Z'),
    estimatedTotalMinutes: 120,
    progressPercent: 0,
    urgencyScore: 0,
    remainingMinutes: 120,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('computeUrgency', () => {
  it('returns 1.0 when deadline has passed', () => {
    const a = makeAssignment({ deadline: new Date('2025-01-01T00:00:00Z') });
    const now = new Date('2025-01-02T00:00:00Z');
    expect(computeUrgency(a, now)).toBe(1);
  });

  it('returns 0 when progress is 100%', () => {
    const a = makeAssignment({ progressPercent: 100 });
    const now = new Date('2025-01-15T00:00:00Z');
    expect(computeUrgency(a, now)).toBe(0);
  });

  it('returns 0 when estimatedTotalMinutes is 0', () => {
    const a = makeAssignment({ estimatedTotalMinutes: 0 });
    const now = new Date('2025-01-15T00:00:00Z');
    expect(computeUrgency(a, now)).toBe(0);
  });

  it('computes correct score for normal case', () => {
    // 120 min total, 0% progress → 120 remaining
    // deadline in 240 min → score = 120/240 = 0.5
    const deadline = new Date('2025-01-15T04:00:00Z');
    const now = new Date('2025-01-15T00:00:00Z');
    const a = makeAssignment({ deadline, estimatedTotalMinutes: 120, progressPercent: 0 });
    expect(computeUrgency(a, now)).toBe(0.5);
  });

  it('accounts for progress in remaining minutes', () => {
    // 200 min total, 50% progress → 100 remaining
    // deadline in 200 min → score = 100/200 = 0.5
    const deadline = new Date('2025-01-15T03:20:00Z');
    const now = new Date('2025-01-15T00:00:00Z');
    const a = makeAssignment({ deadline, estimatedTotalMinutes: 200, progressPercent: 50 });
    expect(computeUrgency(a, now)).toBe(0.5);
  });

  it('clamps score to 1 when remaining work exceeds time left', () => {
    // 600 min total, 0% progress → 600 remaining
    // deadline in 60 min → score = 600/60 = 10 → clamped to 1
    const deadline = new Date('2025-01-15T01:00:00Z');
    const now = new Date('2025-01-15T00:00:00Z');
    const a = makeAssignment({ deadline, estimatedTotalMinutes: 600, progressPercent: 0 });
    expect(computeUrgency(a, now)).toBe(1);
  });

  it('returns 1.0 when now equals deadline with remaining work', () => {
    const deadline = new Date('2025-01-15T00:00:00Z');
    const now = new Date('2025-01-15T00:00:00Z');
    const a = makeAssignment({ deadline, estimatedTotalMinutes: 60, progressPercent: 0 });
    expect(computeUrgency(a, now)).toBe(1);
  });

  it('returns 0 when now equals deadline but no remaining work', () => {
    const deadline = new Date('2025-01-15T00:00:00Z');
    const now = new Date('2025-01-15T00:00:00Z');
    const a = makeAssignment({ deadline, progressPercent: 100 });
    expect(computeUrgency(a, now)).toBe(0);
  });
});
