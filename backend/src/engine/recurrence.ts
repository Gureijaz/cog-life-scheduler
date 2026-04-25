import type { FixedEvent } from '../types/domain';
import { v4 as uuidv4 } from 'uuid';

const DAY_MAP: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

/**
 * Parse a recurrence rule string like "WEEKLY:MON,WED,FRI" into
 * the set of JS day-of-week numbers (0=Sun … 6=Sat).
 * Returns null if the rule is not a valid weekly pattern.
 */
export function parseWeeklyRule(rule: string): number[] | null {
  const parts = rule.split(':');
  if (parts.length !== 2 || parts[0] !== 'WEEKLY') return null;

  const dayTokens = parts[1].split(',').map((d) => d.trim());
  const days: number[] = [];

  for (const token of dayTokens) {
    const num = DAY_MAP[token];
    if (num === undefined) return null;
    days.push(num);
  }

  return days.length > 0 ? days : null;
}

/**
 * Expand a recurring FixedEvent into concrete instances that fall
 * within the planning horizon [horizonStart, horizonEnd] (inclusive).
 *
 * Each generated instance copies the parent's time/duration/metadata
 * but gets a unique id, the matching eventDate, and recurrenceParentId
 * set to the parent event's id.
 */
export function expandRecurrence(
  event: FixedEvent,
  horizonStart: string, // YYYY-MM-DD
  horizonEnd: string,   // YYYY-MM-DD
): FixedEvent[] {
  if (!event.recurrenceRule) return [];

  const days = parseWeeklyRule(event.recurrenceRule);
  if (!days) return [];

  const daySet = new Set(days);
  const instances: FixedEvent[] = [];

  const start = new Date(horizonStart + 'T12:00:00Z');
  const end = new Date(horizonEnd + 'T12:00:00Z');

  const cursor = new Date(start);
  while (cursor <= end) {
    if (daySet.has(cursor.getUTCDay())) {
      const y = cursor.getUTCFullYear();
      const m = String(cursor.getUTCMonth() + 1).padStart(2, '0');
      const d = String(cursor.getUTCDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      instances.push({
        ...event,
        id: uuidv4(),
        eventDate: dateStr,
        recurrenceParentId: event.id,
        recurrenceRule: null, // instances are concrete, not recurring
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return instances;
}
