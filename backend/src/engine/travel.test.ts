import { describe, it, expect } from 'vitest';
import { getTravelTime } from './travel';
import type { TravelRule } from '../types/domain';

const makeRule = (
  originId: string,
  destinationId: string,
  travelMinutes: number,
): TravelRule => ({
  id: `rule-${originId}-${destinationId}`,
  userId: 'user-1',
  originId,
  destinationId,
  travelMinutes,
});

describe('getTravelTime', () => {
  const rules: TravelRule[] = [
    makeRule('home', 'university', 30),
    makeRule('university', 'home', 25),
    makeRule('home', 'gym', 10),
  ];
  const defaultMinutes = 15;

  it('returns matching rule travel time', () => {
    expect(getTravelTime('home', 'university', rules, defaultMinutes)).toBe(30);
  });

  it('treats direction as significant', () => {
    expect(getTravelTime('university', 'home', rules, defaultMinutes)).toBe(25);
  });

  it('falls back to default when no rule exists', () => {
    expect(getTravelTime('university', 'gym', rules, defaultMinutes)).toBe(15);
  });

  it('returns 0 for same location', () => {
    expect(getTravelTime('home', 'home', rules, defaultMinutes)).toBe(0);
  });

  it('falls back to default with empty rules', () => {
    expect(getTravelTime('home', 'university', [], defaultMinutes)).toBe(15);
  });
});
