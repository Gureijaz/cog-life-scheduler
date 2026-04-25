import type { TravelRule } from '../types/domain';

export interface TravelCalculator {
  getTravelTime(
    from: string,
    to: string,
    rules: TravelRule[],
    defaultMinutes: number,
  ): number;
}

/**
 * Looks up travel time between two locations.
 *
 * - Returns 0 if origin and destination are the same.
 * - Searches rules for a matching origin/destination pair.
 * - Falls back to defaultMinutes when no rule exists.
 */
export function getTravelTime(
  from: string,
  to: string,
  rules: TravelRule[],
  defaultMinutes: number,
): number {
  if (from === to) return 0;

  const rule = rules.find(
    (r) => r.originId === from && r.destinationId === to,
  );

  return rule ? rule.travelMinutes : defaultMinutes;
}

export const travelCalculator: TravelCalculator = {
  getTravelTime,
};
