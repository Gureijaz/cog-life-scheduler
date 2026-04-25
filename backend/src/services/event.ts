// Event service — fixed event CRUD and conflict detection
// Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6

import type { FixedEvent } from '../types/domain';
import type { CreateFixedEventInput, ErrorResponse } from '../types/api';
import type { ConflictWarning } from '../types/engine';
import type {
  FixedEventRepository,
  SchedulePlanRepository,
  ScheduleBlockRepository,
} from '../repositories/entities';
import { validateFixedEventInput, validationError, parseTime } from '../validation';
import { expandRecurrence } from '../engine/recurrence';

export class EventService {
  constructor(
    private eventRepo: FixedEventRepository,
    private planRepo: SchedulePlanRepository,
    private blockRepo: ScheduleBlockRepository,
  ) {}

  /** Create a new fixed event. Requirement 2.1 */
  async createFixedEvent(
    userId: string,
    data: CreateFixedEventInput,
  ): Promise<FixedEvent> {
    const validationErr = validateFixedEventInput(data);
    if (validationErr) throw validationErr;

    return this.eventRepo.create({
      userId,
      title: data.title,
      eventDate: data.eventDate,
      startTime: data.startTime,
      endTime: data.endTime,
      locationId: data.locationId ?? null,
      recurrenceRule: data.recurrenceRule ?? null,
      recurrenceParentId: null,
      category: data.category,
      notes: data.notes ?? null,
      createdAt: new Date(),
    });
  }

  /** Update an existing fixed event. Requirement 2.1 */
  async updateFixedEvent(
    eventId: string,
    data: Partial<CreateFixedEventInput>,
  ): Promise<FixedEvent> {
    const existing = await this.eventRepo.findById(eventId);
    if (!existing) {
      throw validationError('NOT_FOUND', `Fixed event ${eventId} not found`, 'eventId', 'Event does not exist', eventId);
    }

    // Validate time range if either time field is being updated
    const startTime = data.startTime ?? existing.startTime;
    const endTime = data.endTime ?? existing.endTime;
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    if (start === null || end === null || end <= start) {
      throw validationError('INVALID_TIME_RANGE', 'End time must be after start time', 'endTime', 'End time must be strictly after start time', endTime);
    }

    return this.eventRepo.update(eventId, {
      ...data,
      locationId: data.locationId !== undefined ? (data.locationId ?? null) : undefined,
      recurrenceRule: data.recurrenceRule !== undefined ? (data.recurrenceRule ?? null) : undefined,
      notes: data.notes !== undefined ? (data.notes ?? null) : undefined,
    } as Partial<FixedEvent>);
  }

  /** Update a single instance of a recurring event. Requirement 2.5 */
  async updateRecurrenceInstance(
    eventId: string,
    instanceDate: string,
    data: Partial<CreateFixedEventInput>,
  ): Promise<FixedEvent> {
    const parent = await this.eventRepo.findById(eventId);
    if (!parent) {
      throw validationError('NOT_FOUND', `Fixed event ${eventId} not found`, 'eventId', 'Event does not exist', eventId);
    }

    // Look for an existing override instance for this date
    const instances = await this.eventRepo.findByUserAndDate(parent.userId, instanceDate);
    const existingInstance = instances.find(
      (e) => e.recurrenceParentId === eventId && e.eventDate === instanceDate,
    );

    if (existingInstance) {
      return this.eventRepo.update(existingInstance.id, data as Partial<FixedEvent>);
    }

    // Create a new instance override from the parent
    const startTime = data.startTime ?? parent.startTime;
    const endTime = data.endTime ?? parent.endTime;
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    if (start === null || end === null || end <= start) {
      throw validationError('INVALID_TIME_RANGE', 'End time must be after start time', 'endTime', 'End time must be strictly after start time', endTime);
    }

    return this.eventRepo.create({
      userId: parent.userId,
      title: data.title ?? parent.title,
      eventDate: instanceDate,
      startTime,
      endTime,
      locationId: data.locationId !== undefined ? (data.locationId ?? null) : parent.locationId,
      recurrenceRule: null, // instance, not recurring
      recurrenceParentId: eventId,
      category: data.category ?? parent.category,
      notes: data.notes !== undefined ? (data.notes ?? null) : parent.notes,
      createdAt: new Date(),
    });
  }

  /** Delete a fixed event and remove associated schedule blocks. Requirement 2.6 */
  async deleteFixedEvent(eventId: string): Promise<void> {
    const existing = await this.eventRepo.findById(eventId);
    if (!existing) {
      throw validationError('NOT_FOUND', `Fixed event ${eventId} not found`, 'eventId', 'Event does not exist', eventId);
    }

    // Find future plans for this user and remove blocks sourced from this event
    const today = new Date().toISOString().slice(0, 10);
    const plans = await this.planRepo.findMany({ userId: existing.userId });
    for (const plan of plans) {
      if (plan.planDate >= today) {
        const blocks = await this.blockRepo.findByPlan(plan.id);
        for (const block of blocks) {
          if (block.sourceType === 'fixed_event' && block.sourceId === eventId) {
            await this.blockRepo.delete(block.id);
          }
        }
      }
    }

    await this.eventRepo.delete(eventId);
  }

  /** Get fixed events for a date, expanding recurring events. Requirements 2.1, 2.4 */
  async getFixedEventsForDate(
    userId: string,
    date: string,
  ): Promise<FixedEvent[]> {
    // Get events directly on this date
    const directEvents = await this.eventRepo.findByUserAndDate(userId, date);

    // Get all recurring events for this user and expand them
    const allEvents = await this.eventRepo.findMany({ userId });
    const recurringParents = allEvents.filter(
      (e) => e.recurrenceRule !== null && e.recurrenceParentId === null,
    );

    const expandedInstances: FixedEvent[] = [];
    for (const parent of recurringParents) {
      const instances = expandRecurrence(parent, date, date);
      expandedInstances.push(...instances);
    }

    // Filter out expanded instances that already have an override in directEvents
    const overriddenParentIds = new Set(
      directEvents
        .filter((e) => e.recurrenceParentId !== null)
        .map((e) => e.recurrenceParentId),
    );

    const nonOverriddenInstances = expandedInstances.filter(
      (inst) => !overriddenParentIds.has(inst.recurrenceParentId),
    );

    // Combine: direct events + non-overridden expanded instances
    // Avoid duplicates: direct events already on this date that are non-recurring
    const directIds = new Set(directEvents.map((e) => e.id));
    const combined = [
      ...directEvents,
      ...nonOverriddenInstances.filter((inst) => !directIds.has(inst.id)),
    ];

    return combined;
  }

  /** Check for time conflicts with existing events. Requirement 2.3 */
  async checkConflicts(
    userId: string,
    event: Pick<FixedEvent, 'eventDate' | 'startTime' | 'endTime' | 'id'>,
  ): Promise<ConflictWarning[]> {
    const existingEvents = await this.getFixedEventsForDate(userId, event.eventDate);
    const warnings: ConflictWarning[] = [];

    const newStart = parseTime(event.startTime)!;
    const newEnd = parseTime(event.endTime)!;

    for (const existing of existingEvents) {
      // Skip self
      if (existing.id === event.id) continue;

      const existStart = parseTime(existing.startTime)!;
      const existEnd = parseTime(existing.endTime)!;

      // Overlap: one starts before the other ends and vice versa
      if (newStart < existEnd && newEnd > existStart) {
        const overlapStart = Math.max(newStart, existStart);
        const overlapEnd = Math.min(newEnd, existEnd);

        const overlapStartStr = `${String(Math.floor(overlapStart / 60)).padStart(2, '0')}:${String(overlapStart % 60).padStart(2, '0')}`;
        const overlapEndStr = `${String(Math.floor(overlapEnd / 60)).padStart(2, '0')}:${String(overlapEnd % 60).padStart(2, '0')}`;

        warnings.push({
          existingEventId: existing.id,
          existingEventTitle: existing.title,
          overlapStart: overlapStartStr,
          overlapEnd: overlapEndStr,
        });
      }
    }

    return warnings;
  }
}
