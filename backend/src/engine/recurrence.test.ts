import { describe, it, expect } from 'vitest';
import { parseWeeklyRule, expandRecurrence } from './recurrence';
import type { FixedEvent } from '../types/domain';

const makeEvent = (overrides: Partial<FixedEvent> = {}): FixedEvent => ({
  id: 'parent-1',
  userId: 'user-1',
  title: 'CS 101',
  eventDate: '2025-01-06',
  startTime: '09:00',
  endTime: '10:30',
  locationId: 'loc-1',
  recurrenceRule: 'WEEKLY:MON,WED,FRI',
  recurrenceParentId: null,
  category: 'class',
  notes: null,
  createdAt: new Date('2025-01-01'),
  ...overrides,
});

describe('parseWeeklyRule', () => {
  it('parses a valid weekly rule', () => {
    expect(parseWeeklyRule('WEEKLY:MON,WED,FRI')).toEqual([1, 3, 5]);
  });

  it('parses a single-day rule', () => {
    expect(parseWeeklyRule('WEEKLY:TUE')).toEqual([2]);
  });

  it('returns null for non-WEEKLY prefix', () => {
    expect(parseWeeklyRule('DAILY:MON')).toBeNull();
  });

  it('returns null for invalid day token', () => {
    expect(parseWeeklyRule('WEEKLY:MON,XYZ')).toBeNull();
  });

  it('returns null for empty days', () => {
    expect(parseWeeklyRule('WEEKLY:')).toBeNull();
  });

  it('returns null for missing colon', () => {
    expect(parseWeeklyRule('WEEKLYMON')).toBeNull();
  });
});

describe('expandRecurrence', () => {
  it('generates instances on correct days within horizon', () => {
    const event = makeEvent();
    // 2025-01-06 is a Monday. Horizon: Mon Jan 6 – Sun Jan 12
    const instances = expandRecurrence(event, '2025-01-06', '2025-01-12');

    const dates = instances.map((i) => i.eventDate);
    // Mon 6, Wed 8, Fri 10
    expect(dates).toEqual(['2025-01-06', '2025-01-08', '2025-01-10']);
  });

  it('sets recurrenceParentId to parent event id', () => {
    const event = makeEvent();
    const instances = expandRecurrence(event, '2025-01-06', '2025-01-06');

    expect(instances).toHaveLength(1);
    expect(instances[0].recurrenceParentId).toBe('parent-1');
  });

  it('clears recurrenceRule on generated instances', () => {
    const event = makeEvent();
    const instances = expandRecurrence(event, '2025-01-06', '2025-01-06');

    expect(instances[0].recurrenceRule).toBeNull();
  });

  it('preserves time and metadata from parent', () => {
    const event = makeEvent();
    const instances = expandRecurrence(event, '2025-01-06', '2025-01-06');

    expect(instances[0].startTime).toBe('09:00');
    expect(instances[0].endTime).toBe('10:30');
    expect(instances[0].title).toBe('CS 101');
    expect(instances[0].locationId).toBe('loc-1');
    expect(instances[0].category).toBe('class');
    expect(instances[0].userId).toBe('user-1');
  });

  it('generates unique ids for each instance', () => {
    const event = makeEvent();
    const instances = expandRecurrence(event, '2025-01-06', '2025-01-12');

    const ids = instances.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    // None should match the parent id
    ids.forEach((id) => expect(id).not.toBe('parent-1'));
  });

  it('returns empty array when event has no recurrence rule', () => {
    const event = makeEvent({ recurrenceRule: null });
    expect(expandRecurrence(event, '2025-01-06', '2025-01-12')).toEqual([]);
  });

  it('returns empty array when no matching days in horizon', () => {
    // WEEKLY:SAT — horizon is Mon-Fri
    const event = makeEvent({ recurrenceRule: 'WEEKLY:SAT' });
    const instances = expandRecurrence(event, '2025-01-06', '2025-01-10');
    expect(instances).toEqual([]);
  });

  it('handles TUE,THU pattern', () => {
    const event = makeEvent({ recurrenceRule: 'WEEKLY:TUE,THU' });
    // Mon Jan 6 – Sun Jan 12
    const instances = expandRecurrence(event, '2025-01-06', '2025-01-12');
    const dates = instances.map((i) => i.eventDate);
    // Tue 7, Thu 9
    expect(dates).toEqual(['2025-01-07', '2025-01-09']);
  });

  it('includes both boundary dates when they match', () => {
    // WEEKLY:MON — horizon starts and ends on Mondays
    const event = makeEvent({ recurrenceRule: 'WEEKLY:MON' });
    const instances = expandRecurrence(event, '2025-01-06', '2025-01-13');
    const dates = instances.map((i) => i.eventDate);
    expect(dates).toEqual(['2025-01-06', '2025-01-13']);
  });

  it('handles multi-week horizon', () => {
    const event = makeEvent({ recurrenceRule: 'WEEKLY:FRI' });
    // 3 weeks: Jan 6 – Jan 26
    const instances = expandRecurrence(event, '2025-01-06', '2025-01-26');
    const dates = instances.map((i) => i.eventDate);
    // Fri 10, Fri 17, Fri 24
    expect(dates).toEqual(['2025-01-10', '2025-01-17', '2025-01-24']);
  });
});
