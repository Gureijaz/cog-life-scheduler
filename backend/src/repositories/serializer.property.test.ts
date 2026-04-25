import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { toSnakeCaseKeys, toCamelCaseKeys } from './serializer';
import type { SchedulePlan, ScheduleBlock, SourceType } from '../types/domain';

/**
 * Arbitrary for valid HH:mm time strings.
 */
const timeArb = fc
  .record({
    hours: fc.integer({ min: 0, max: 23 }),
    minutes: fc.integer({ min: 0, max: 59 }),
  })
  .map(({ hours, minutes }) => {
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return `${hh}:${mm}`;
  });

/**
 * Arbitrary for valid YYYY-MM-DD date strings.
 */
const dateStrArb = fc
  .record({
    year: fc.integer({ min: 2020, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
  })
  .map(({ year, month, day }) => {
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  });

/**
 * Arbitrary for SourceType enum values.
 */
const sourceTypeArb: fc.Arbitrary<SourceType> = fc.constantFrom(
  'fixed_event',
  'flexible_task',
  'assignment',
  'travel_buffer'
);

/**
 * Arbitrary for a valid time pair where start < end.
 */
const orderedTimePairArb = fc
  .record({
    startH: fc.integer({ min: 0, max: 22 }),
    startM: fc.integer({ min: 0, max: 59 }),
    gap: fc.integer({ min: 1, max: 300 }),
  })
  .filter(({ startH, startM, gap }) => startH * 60 + startM + gap < 24 * 60)
  .map(({ startH, startM, gap }) => {
    const startTotal = startH * 60 + startM;
    const endTotal = startTotal + gap;
    const format = (mins: number) => {
      const h = String(Math.floor(mins / 60)).padStart(2, '0');
      const m = String(mins % 60).padStart(2, '0');
      return `${h}:${m}`;
    };
    return { startTime: format(startTotal), endTime: format(endTotal) };
  });

/**
 * Arbitrary for a valid ScheduleBlock.
 */
const scheduleBlockArb: fc.Arbitrary<ScheduleBlock> = fc
  .record({
    id: fc.uuid(),
    planId: fc.uuid(),
    sourceType: sourceTypeArb,
    sourceId: fc.option(fc.uuid(), { nil: null }),
    title: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
    timePair: orderedTimePairArb,
    locationId: fc.option(fc.uuid(), { nil: null }),
    locked: fc.boolean(),
    sortOrder: fc.integer({ min: 0, max: 100 }),
  })
  .map(({ timePair, ...rest }) => ({
    ...rest,
    startTime: timePair.startTime,
    endTime: timePair.endTime,
  }));

/**
 * Arbitrary for a valid SchedulePlan with blocks.
 */
const schedulePlanArb: fc.Arbitrary<SchedulePlan> = fc
  .record({
    id: fc.uuid(),
    userId: fc.uuid(),
    planDate: dateStrArb,
    version: fc.integer({ min: 1, max: 100 }),
    generatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
    blocks: fc.array(scheduleBlockArb, { minLength: 0, maxLength: 10 }),
  });

/**
 * Serializes a SchedulePlan to a JSON string (snake_case keys),
 * matching what the system does for API transmission (Req 12.1).
 */
function serializeSchedulePlan(plan: SchedulePlan): string {
  const serialized = toSnakeCaseKeys(plan as unknown as Record<string, unknown>);
  // Also serialize nested blocks
  if (Array.isArray(plan.blocks)) {
    serialized['blocks'] = plan.blocks.map((block) =>
      toSnakeCaseKeys(block as unknown as Record<string, unknown>)
    );
  }
  return JSON.stringify(serialized);
}

/**
 * Deserializes a JSON string back into a SchedulePlan (camelCase keys),
 * matching what the system does when receiving API data (Req 12.2).
 */
function deserializeSchedulePlan(json: string): SchedulePlan {
  const parsed = JSON.parse(json);
  const plan = toCamelCaseKeys<SchedulePlan>(parsed);
  // Also deserialize nested blocks
  if (Array.isArray(parsed.blocks)) {
    (plan as Record<string, unknown>).blocks = parsed.blocks.map(
      (block: Record<string, unknown>) => toCamelCaseKeys<ScheduleBlock>(block)
    );
  }
  // Restore Date objects from ISO strings
  (plan as Record<string, unknown>).generatedAt = new Date(plan.generatedAt as unknown as string);
  return plan;
}

describe('Property 26: Schedule Plan Serialization Round Trip', () => {
  /**
   * **Validates: Requirements 12.1, 12.2, 12.3**
   *
   * For any valid SchedulePlan object, serializing it to JSON and then
   * deserializing the JSON back to a SchedulePlan object SHALL produce
   * an object deeply equal to the original.
   */
  it('should produce a deeply equal object after serialize → deserialize round trip', () => {
    fc.assert(
      fc.property(schedulePlanArb, (plan) => {
        const json = serializeSchedulePlan(plan);
        const restored = deserializeSchedulePlan(json);

        // Verify top-level scalar fields
        expect(restored.id).toBe(plan.id);
        expect(restored.userId).toBe(plan.userId);
        expect(restored.planDate).toBe(plan.planDate);
        expect(restored.version).toBe(plan.version);
        expect(restored.generatedAt.getTime()).toBe(plan.generatedAt.getTime());

        // Verify blocks array length
        expect(restored.blocks).toHaveLength(plan.blocks.length);

        // Verify each block deeply
        for (let i = 0; i < plan.blocks.length; i++) {
          const original = plan.blocks[i];
          const round = restored.blocks[i];

          expect(round.id).toBe(original.id);
          expect(round.planId).toBe(original.planId);
          expect(round.sourceType).toBe(original.sourceType);
          expect(round.sourceId).toBe(original.sourceId);
          expect(round.title).toBe(original.title);
          expect(round.startTime).toBe(original.startTime);
          expect(round.endTime).toBe(original.endTime);
          expect(round.locationId).toBe(original.locationId);
          expect(round.locked).toBe(original.locked);
          expect(round.sortOrder).toBe(original.sortOrder);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('should produce valid JSON during serialization', () => {
    fc.assert(
      fc.property(schedulePlanArb, (plan) => {
        const json = serializeSchedulePlan(plan);

        // Must be valid JSON
        expect(() => JSON.parse(json)).not.toThrow();

        // Parsed JSON should have snake_case keys
        const parsed = JSON.parse(json);
        expect(parsed).toHaveProperty('user_id');
        expect(parsed).toHaveProperty('plan_date');
        expect(parsed).toHaveProperty('generated_at');

        // Blocks should also have snake_case keys
        if (parsed.blocks && parsed.blocks.length > 0) {
          expect(parsed.blocks[0]).toHaveProperty('plan_id');
          expect(parsed.blocks[0]).toHaveProperty('source_type');
          expect(parsed.blocks[0]).toHaveProperty('start_time');
          expect(parsed.blocks[0]).toHaveProperty('end_time');
          expect(parsed.blocks[0]).toHaveProperty('sort_order');
        }
      }),
      { numRuns: 100 }
    );
  });
});
