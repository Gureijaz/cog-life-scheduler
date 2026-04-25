import { v4 as uuidv4 } from 'uuid';
import type {
  FixedEvent,
  FlexibleTask,
  Priority,
  ScheduleBlock,
  SchedulePlan,
  Assignment,
  Explanation,
  TravelRule,
} from '../types/domain';
import type {
  AtRiskAssignment,
  ScheduleInput,
  ScheduleResult,
  UnscheduledItem,
} from '../types/engine';
import { computeUrgency } from './urgency';
import { getTravelTime } from './travel';
import { parseTime } from '../validation';

/** An assignment paired with its computed urgency score. */
export interface ScoredAssignment {
  assignment: Assignment;
  urgencyScore: number;
}

/**
 * Converts an HH:mm time string to total minutes since midnight.
 * Throws if the format is invalid.
 */
export function timeToMinutes(time: string): number {
  const parsed = parseTime(time);
  if (parsed === null) {
    throw new Error(`Invalid time format: ${time}`);
  }
  return parsed;
}

/**
 * Converts total minutes since midnight back to an HH:mm string.
 */
export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(minutes, 24 * 60 - 1));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Phase 1 — Place Hard Constraints
// ---------------------------------------------------------------------------

/**
 * Converts a FixedEvent into a ScheduleBlock.
 */
function fixedEventToBlock(event: FixedEvent, planId: string, sortOrder: number): ScheduleBlock {
  return {
    id: uuidv4(),
    planId,
    sourceType: 'fixed_event',
    sourceId: event.id,
    title: event.title,
    startTime: event.startTime,
    endTime: event.endTime,
    locationId: event.locationId,
    locked: false,
    sortOrder,
  };
}

/**
 * Phase 1: Place all FixedEvents and LockedBlocks as immovable blocks.
 *
 * FixedEvents are converted to ScheduleBlocks. LockedBlocks are carried
 * over as-is (they already are ScheduleBlocks). The combined list is
 * sorted by start time.
 */
export function placeHardConstraints(
  fixedEvents: FixedEvent[],
  lockedBlocks: ScheduleBlock[],
  planId: string,
): ScheduleBlock[] {
  const blocks: ScheduleBlock[] = [];

  // Convert each fixed event into a schedule block
  fixedEvents.forEach((event, index) => {
    blocks.push(fixedEventToBlock(event, planId, index));
  });

  // Carry over locked blocks — they are already ScheduleBlocks
  lockedBlocks.forEach((lb) => {
    blocks.push({ ...lb, planId });
  });

  // Sort by start time so downstream phases can reason about ordering
  blocks.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  // Re-assign sort orders after sorting
  blocks.forEach((block, idx) => {
    block.sortOrder = idx;
  });

  return blocks;
}

// ---------------------------------------------------------------------------
// Phase 2 — Compute Urgency
// ---------------------------------------------------------------------------

/**
 * Phase 2: Compute urgency scores for all assignments and return them
 * sorted in descending urgency order (most urgent first).
 */
export function computeAndSortByUrgency(
  assignments: Assignment[],
  now: Date,
): ScoredAssignment[] {
  const scored: ScoredAssignment[] = assignments.map((assignment) => ({
    assignment,
    urgencyScore: computeUrgency(assignment, now),
  }));

  // Sort descending by urgency score (highest urgency first)
  scored.sort((a, b) => b.urgencyScore - a.urgencyScore);

  return scored;
}

// ---------------------------------------------------------------------------
// Phase 3 — Place Deadline-Critical Items
// ---------------------------------------------------------------------------

/** Represents a gap of free time between existing blocks. */
interface TimeGap {
  startMin: number;
  endMin: number;
}

/**
 * Finds available time gaps between existing blocks within the waking window.
 * The waking window is defined by wakeTime and sleepTime from preferences.
 */
export function findAvailableGaps(
  blocks: ScheduleBlock[],
  wakeTime: string,
  sleepTime: string,
): TimeGap[] {
  const wakeMin = timeToMinutes(wakeTime);
  const sleepMin = timeToMinutes(sleepTime);
  const gaps: TimeGap[] = [];

  // Sort blocks by start time
  const sorted = [...blocks].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
  );

  let cursor = wakeMin;

  for (const block of sorted) {
    const blockStart = timeToMinutes(block.startTime);
    const blockEnd = timeToMinutes(block.endTime);

    // Skip blocks entirely before cursor
    if (blockEnd <= cursor) continue;

    // If there's a gap before this block, record it
    if (blockStart > cursor) {
      const gapEnd = Math.min(blockStart, sleepMin);
      if (gapEnd > cursor) {
        gaps.push({ startMin: cursor, endMin: gapEnd });
      }
    }

    cursor = Math.max(cursor, blockEnd);

    // If we've passed sleep time, stop
    if (cursor >= sleepMin) break;
  }

  // Gap after the last block until sleep time
  if (cursor < sleepMin) {
    gaps.push({ startMin: cursor, endMin: sleepMin });
  }

  return gaps;
}

/**
 * Converts an assignment's deadline to minutes-since-midnight for the schedule date.
 * If the deadline is on a future date relative to scheduleDate, returns the end of day (sleepMin).
 * If the deadline is on the schedule date, returns the deadline's time in minutes.
 * If the deadline is in the past relative to scheduleDate, returns 0 (no time available).
 */
export function deadlineToMinutes(deadline: Date, scheduleDate: string, sleepMin: number): number {
  const deadlineDate = deadline.toISOString().slice(0, 10);

  if (deadlineDate > scheduleDate) {
    // Deadline is on a future date — entire day is available
    return sleepMin;
  }

  if (deadlineDate === scheduleDate) {
    // Deadline is today — convert to minutes since midnight
    const hours = deadline.getUTCHours();
    const minutes = deadline.getUTCMinutes();
    return hours * 60 + minutes;
  }

  // Deadline has already passed
  return 0;
}

/**
 * Phase 3: Allocate blocks for assignments sorted by urgency (highest first).
 * Never place an assignment block after its deadline.
 * Returns the new blocks to add and any unscheduled items.
 */
export function placeDeadlineCriticalItems(
  scoredAssignments: ScoredAssignment[],
  existingBlocks: ScheduleBlock[],
  planId: string,
  scheduleDate: string,
  wakeTime: string,
  sleepTime: string,
): { newBlocks: ScheduleBlock[]; unscheduledItems: UnscheduledItem[] } {
  const sleepMin = timeToMinutes(sleepTime);
  const newBlocks: ScheduleBlock[] = [];
  const unscheduledItems: UnscheduledItem[] = [];

  // Work with a combined list of blocks (existing + newly placed) to track gaps
  const allBlocks = [...existingBlocks];

  for (const { assignment, urgencyScore } of scoredAssignments) {
    // Skip fully completed assignments
    if (assignment.progressPercent >= 100 || assignment.remainingMinutes <= 0) {
      continue;
    }

    const deadlineMin = deadlineToMinutes(assignment.deadline, scheduleDate, sleepMin);

    // If deadline has passed (deadlineMin === 0), still try to schedule but with full day
    // Actually, if deadline is 0, there's no valid window — report as unscheduled
    if (deadlineMin <= 0) {
      unscheduledItems.push({
        sourceType: 'assignment',
        sourceId: assignment.id,
        title: assignment.title,
        reason: 'Deadline has already passed',
      });
      continue;
    }

    let remainingToSchedule = assignment.remainingMinutes;
    const gaps = findAvailableGaps(allBlocks, wakeTime, sleepTime);

    for (const gap of gaps) {
      if (remainingToSchedule <= 0) break;

      // Constrain gap end by the deadline
      const effectiveEnd = Math.min(gap.endMin, deadlineMin);
      if (effectiveEnd <= gap.startMin) continue;

      const availableInGap = effectiveEnd - gap.startMin;
      const allocate = Math.min(availableInGap, remainingToSchedule);

      if (allocate <= 0) continue;

      const block: ScheduleBlock = {
        id: uuidv4(),
        planId,
        sourceType: 'assignment',
        sourceId: assignment.id,
        title: assignment.title,
        startTime: minutesToTime(gap.startMin),
        endTime: minutesToTime(gap.startMin + allocate),
        locationId: null,
        locked: false,
        sortOrder: 0,
      };

      newBlocks.push(block);
      allBlocks.push(block);
      remainingToSchedule -= allocate;
    }

    if (remainingToSchedule > 0) {
      unscheduledItems.push({
        sourceType: 'assignment',
        sourceId: assignment.id,
        title: assignment.title,
        reason: `Could not schedule ${remainingToSchedule} of ${assignment.remainingMinutes} minutes before deadline`,
      });
    }
  }

  return { newBlocks, unscheduledItems };
}

// ---------------------------------------------------------------------------
// Phase 4 — Insert Travel Buffers
// ---------------------------------------------------------------------------

/**
 * Phase 4: Scan all adjacent block pairs. If two adjacent blocks are at
 * different locations, insert a travel buffer block between them.
 *
 * After inserting travel buffers, re-sort blocks by start time and
 * re-assign sort orders.
 */
export function insertTravelBuffers(
  blocks: ScheduleBlock[],
  travelRules: TravelRule[],
  defaultCommuteMinutes: number,
  planId: string,
): ScheduleBlock[] {
  // Sort blocks by start time first
  const sorted = [...blocks].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
  );

  const result: ScheduleBlock[] = [];

  for (let i = 0; i < sorted.length; i++) {
    result.push(sorted[i]);

    // Check if there's a next block with a different location
    if (i < sorted.length - 1) {
      const current = sorted[i];
      const next = sorted[i + 1];

      // Both blocks must have locations, and they must differ
      if (
        current.locationId !== null &&
        next.locationId !== null &&
        current.locationId !== next.locationId
      ) {
        const travelMinutes = getTravelTime(
          current.locationId,
          next.locationId,
          travelRules,
          defaultCommuteMinutes,
        );

        if (travelMinutes > 0) {
          const currentEndMin = timeToMinutes(current.endTime);
          const nextStartMin = timeToMinutes(next.startTime);
          const gapMinutes = nextStartMin - currentEndMin;

          // Only insert a travel buffer if there's room for it
          // The buffer occupies the gap (or part of it)
          const bufferDuration = Math.min(travelMinutes, Math.max(gapMinutes, 0));

          if (bufferDuration > 0) {
            const travelBlock: ScheduleBlock = {
              id: uuidv4(),
              planId,
              sourceType: 'travel_buffer',
              sourceId: null,
              title: `Travel: ${current.title} → ${next.title}`,
              startTime: current.endTime,
              endTime: minutesToTime(currentEndMin + bufferDuration),
              locationId: null,
              locked: false,
              sortOrder: 0,
            };

            result.push(travelBlock);
          }
        }
      }
    }
  }

  // Re-sort by start time and re-assign sort orders
  result.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  result.forEach((block, idx) => {
    block.sortOrder = idx;
  });

  return result;
}

// ---------------------------------------------------------------------------
// Phase 5 — Apply Wellbeing Constraints
// ---------------------------------------------------------------------------

/**
 * Phase 5: Enforce wellbeing constraints on existing blocks.
 *
 * 1. Remove blocks that fall within the sleep window (sleepTime → wakeTime).
 * 2. Split blocks that exceed maxDeepWorkMinutes.
 * 3. Ensure minimum buffer time (minBufferMinutes) between non-travel blocks
 *    by trimming the later block's start if needed.
 */
export function applyWellbeingConstraints(
  blocks: ScheduleBlock[],
  wakeTime: string,
  sleepTime: string,
  maxDeepWorkMinutes: number,
  minBufferMinutes: number,
  planId: string,
): ScheduleBlock[] {
  const wakeMin = timeToMinutes(wakeTime);
  const sleepMin = timeToMinutes(sleepTime);

  // Step 1: Remove / trim blocks in the sleep window
  let result: ScheduleBlock[] = [];
  for (const block of blocks) {
    const bStart = timeToMinutes(block.startTime);
    const bEnd = timeToMinutes(block.endTime);

    // Block entirely within sleep window → remove
    if (bStart >= sleepMin || bEnd <= wakeMin) {
      continue;
    }

    // Block partially overlaps sleep window → trim
    const clampedStart = Math.max(bStart, wakeMin);
    const clampedEnd = Math.min(bEnd, sleepMin);

    if (clampedEnd <= clampedStart) continue;

    result.push({
      ...block,
      startTime: minutesToTime(clampedStart),
      endTime: minutesToTime(clampedEnd),
    });
  }

  // Step 2: Split blocks exceeding maxDeepWorkMinutes
  if (maxDeepWorkMinutes > 0) {
    const split: ScheduleBlock[] = [];
    for (const block of result) {
      // Only split non-travel, non-fixed blocks
      if (block.sourceType === 'travel_buffer' || block.sourceType === 'fixed_event' || block.locked) {
        split.push(block);
        continue;
      }

      const bStart = timeToMinutes(block.startTime);
      const bEnd = timeToMinutes(block.endTime);
      const duration = bEnd - bStart;

      if (duration <= maxDeepWorkMinutes) {
        split.push(block);
        continue;
      }

      // Split into chunks of maxDeepWorkMinutes
      let cursor = bStart;
      let isFirst = true;
      while (cursor < bEnd) {
        const remaining = bEnd - cursor;
        let chunkEnd: number;
        // If the remainder after this chunk would be too small, absorb it
        if (remaining > maxDeepWorkMinutes && remaining - maxDeepWorkMinutes < minBufferMinutes) {
          chunkEnd = bEnd; // take the whole remainder
        } else {
          chunkEnd = Math.min(cursor + maxDeepWorkMinutes, bEnd);
        }
        split.push({
          ...block,
          id: isFirst ? block.id : uuidv4(),
          startTime: minutesToTime(cursor),
          endTime: minutesToTime(chunkEnd),
        });
        cursor = chunkEnd;
        isFirst = false;
      }
    }
    result = split;
  }

  // Step 3: Ensure minimum buffer between non-travel blocks
  if (minBufferMinutes > 0) {
    // Sort by start time
    result.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1];
      const curr = result[i];

      // Skip buffer enforcement for travel blocks, fixed events, and locked blocks
      if (prev.sourceType === 'travel_buffer' || curr.sourceType === 'travel_buffer') {
        continue;
      }
      if (curr.sourceType === 'fixed_event' || curr.locked) {
        continue;
      }

      const prevEnd = timeToMinutes(prev.endTime);
      const currStart = timeToMinutes(curr.startTime);
      const gap = currStart - prevEnd;

      if (gap > 0 && gap < minBufferMinutes) {
        // Trim the later block's start forward to create the buffer
        const newStart = prevEnd + minBufferMinutes;
        const currEnd = timeToMinutes(curr.endTime);
        if (newStart < currEnd) {
          result[i] = {
            ...curr,
            startTime: minutesToTime(newStart),
          };
        } else {
          // Block would become zero or negative duration — remove it
          result.splice(i, 1);
          i--;
        }
      }
    }
  }

  // Re-sort and re-assign sort orders
  result.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  // Step 4: Remove non-exempt blocks shorter than minBufferMinutes
  if (minBufferMinutes > 0) {
    result = result.filter(block => {
      if (block.sourceType === 'travel_buffer' || block.sourceType === 'fixed_event' || block.locked) {
        return true;
      }
      const dur = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
      return dur >= minBufferMinutes;
    });
  }

  result.forEach((block, idx) => {
    block.sortOrder = idx;
  });

  return result;
}

// ---------------------------------------------------------------------------
// Phase 6 — Place Remaining Items (Flexible Tasks)
// ---------------------------------------------------------------------------

const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Phase 6: Fill remaining gaps with flexible tasks, sorted by priority
 * (highest first). Respects minSessionMinutes per task and splits tasks
 * across multiple blocks when needed.
 *
 * Returns new blocks and any unscheduled flexible tasks.
 */
export function placeRemainingItems(
  flexibleTasks: FlexibleTask[],
  existingBlocks: ScheduleBlock[],
  planId: string,
  wakeTime: string,
  sleepTime: string,
  minBufferMinutes: number,
): { newBlocks: ScheduleBlock[]; unscheduledItems: UnscheduledItem[] } {
  const newBlocks: ScheduleBlock[] = [];
  const unscheduledItems: UnscheduledItem[] = [];

  // Sort tasks by priority descending (critical first)
  const sorted = [...flexibleTasks].sort(
    (a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority],
  );

  // Track all blocks (existing + newly placed) for gap computation
  const allBlocks = [...existingBlocks];

  for (const task of sorted) {
    if (task.remainingMinutes <= 0) continue;

    let remainingToSchedule = task.remainingMinutes;
    const gaps = findAvailableGaps(allBlocks, wakeTime, sleepTime);

    for (const gap of gaps) {
      if (remainingToSchedule <= 0) break;

      const gapDuration = gap.endMin - gap.startMin;

      // Skip gaps that are too small for the minimum session
      if (gapDuration < task.minSessionMinutes) continue;

      // Also skip gaps smaller than minBufferMinutes (Req 6.5)
      if (gapDuration < minBufferMinutes) continue;

      const allocate = Math.min(gapDuration, remainingToSchedule);

      // Don't create blocks shorter than minSessionMinutes
      if (allocate < task.minSessionMinutes) continue;

      const block: ScheduleBlock = {
        id: uuidv4(),
        planId,
        sourceType: 'flexible_task',
        sourceId: task.id,
        title: task.title,
        startTime: minutesToTime(gap.startMin),
        endTime: minutesToTime(gap.startMin + allocate),
        locationId: null,
        locked: false,
        sortOrder: 0,
      };

      newBlocks.push(block);
      allBlocks.push(block);
      remainingToSchedule -= allocate;
    }

    if (remainingToSchedule > 0) {
      unscheduledItems.push({
        sourceType: 'flexible_task',
        sourceId: task.id,
        title: task.title,
        reason: `Could not schedule ${remainingToSchedule} of ${task.remainingMinutes} minutes`,
      });
    }
  }

  return { newBlocks, unscheduledItems };
}

// ---------------------------------------------------------------------------
// Phase 7 — Generate Explanations
// ---------------------------------------------------------------------------

/**
 * Phase 7: Generate an Explanation record for every placed block.
 *
 * Each explanation references the specific constraints and preferences
 * that influenced the block's placement.
 */
export function generateExplanations(
  blocks: ScheduleBlock[],
  input: ScheduleInput,
): Map<string, Explanation> {
  const explanations = new Map<string, Explanation>();
  const now = new Date();

  // Build lookup maps for source items
  const assignmentMap = new Map(input.assignments.map(a => [a.id, a]));
  const taskMap = new Map(input.flexibleTasks.map(t => [t.id, t]));
  const eventMap = new Map(input.fixedEvents.map(e => [e.id, e]));

  // Build a travel rule lookup for explanation text
  const travelRuleLookup = (originId: string | null, destId: string | null): TravelRule | undefined => {
    if (!originId || !destId) return undefined;
    return input.travelRules.find(r => r.originId === originId && r.destinationId === destId);
  };

  for (const block of blocks) {
    let explanationText: string;
    const referencedConstraints: string[] = [];

    switch (block.sourceType) {
      case 'fixed_event': {
        const event = block.sourceId ? eventMap.get(block.sourceId) : undefined;
        explanationText = `Placed as a hard constraint at its defined time ${block.startTime}–${block.endTime}.`;
        referencedConstraints.push('Fixed_Event hard constraint');
        if (event?.category) {
          explanationText += ` Category: ${event.category}.`;
        }
        if (block.locked) {
          explanationText += ' Block is locked by user.';
          referencedConstraints.push('Locked_Block');
        }
        break;
      }

      case 'assignment': {
        const assignment = block.sourceId ? assignmentMap.get(block.sourceId) : undefined;
        if (assignment) {
          const deadlineStr = assignment.deadline.toISOString().slice(0, 10);
          const urgency = computeUrgency(assignment, now);
          explanationText = `Assignment "${assignment.title}" scheduled with urgency score ${urgency.toFixed(2)}.`;
          referencedConstraints.push('Assignment deadline proximity');

          if (urgency >= 0.8) {
            explanationText += ` High urgency — deadline ${deadlineStr} is approaching.`;
            referencedConstraints.push('Urgency-based priority');
          }

          explanationText += ` Placed in gap at ${block.startTime}–${block.endTime}.`;

          // Check if placed outside preferred focus windows (suboptimal)
          if (input.preferences.focusWindows.length > 0) {
            const blockStartMin = timeToMinutes(block.startTime);
            const blockEndMin = timeToMinutes(block.endTime);
            const inFocusWindow = input.preferences.focusWindows.some(w => {
              const wStart = timeToMinutes(w.start);
              const wEnd = timeToMinutes(w.end);
              return blockStartMin >= wStart && blockEndMin <= wEnd;
            });
            if (!inFocusWindow) {
              explanationText += ' Placed outside preferred focus window due to constraint conflicts.';
              referencedConstraints.push('Focus window preference (suboptimal)');
            }
          }
        } else {
          explanationText = `Assignment block placed at ${block.startTime}–${block.endTime}.`;
          referencedConstraints.push('Assignment scheduling');
        }
        break;
      }

      case 'flexible_task': {
        const task = block.sourceId ? taskMap.get(block.sourceId) : undefined;
        if (task) {
          explanationText = `Flexible task "${task.title}" (priority: ${task.priority}) placed in gap at ${block.startTime}–${block.endTime}.`;
          referencedConstraints.push(`Priority level: ${task.priority}`);

          // Check preferred window
          if (task.preferredWindow) {
            const blockStartMin = timeToMinutes(block.startTime);
            const blockEndMin = timeToMinutes(block.endTime);
            const prefStart = timeToMinutes(task.preferredWindow.start);
            const prefEnd = timeToMinutes(task.preferredWindow.end);
            if (blockStartMin >= prefStart && blockEndMin <= prefEnd) {
              explanationText += ' Placed within preferred window.';
              referencedConstraints.push('Preferred window satisfied');
            } else {
              explanationText += ` Preferred window ${task.preferredWindow.start}–${task.preferredWindow.end} was unavailable; placed in next best gap.`;
              referencedConstraints.push('Preferred window conflict (suboptimal)');
            }
          }
        } else {
          explanationText = `Flexible task block placed at ${block.startTime}–${block.endTime}.`;
          referencedConstraints.push('Flexible task scheduling');
        }

        if (block.locked) {
          explanationText += ' Block is locked by user.';
          referencedConstraints.push('Locked_Block');
        }
        break;
      }

      case 'travel_buffer': {
        // Find adjacent blocks to describe the travel
        const blockIdx = blocks.indexOf(block);
        const prevBlock = blockIdx > 0 ? blocks[blockIdx - 1] : undefined;
        const nextBlock = blockIdx < blocks.length - 1 ? blocks[blockIdx + 1] : undefined;

        const rule = travelRuleLookup(prevBlock?.locationId ?? null, nextBlock?.locationId ?? null);
        if (rule) {
          explanationText = `Travel buffer of ${timeToMinutes(block.endTime) - timeToMinutes(block.startTime)} minutes using Travel_Rule between ${prevBlock?.title ?? 'previous'} and ${nextBlock?.title ?? 'next'} (${rule.travelMinutes} min rule).`;
          referencedConstraints.push(`Travel_Rule between ${prevBlock?.title ?? 'origin'} and ${nextBlock?.title ?? 'destination'}`);
        } else {
          explanationText = `Travel buffer of ${timeToMinutes(block.endTime) - timeToMinutes(block.startTime)} minutes using default commute time (${input.preferences.defaultCommuteMinutes} min).`;
          referencedConstraints.push('Default commute time');
        }
        break;
      }

      default:
        explanationText = `Block placed at ${block.startTime}–${block.endTime}.`;
        referencedConstraints.push('General scheduling');
    }

    explanations.set(block.id, {
      id: uuidv4(),
      blockId: block.id,
      explanationText,
      referencedConstraints,
      createdAt: now,
    });
  }

  return explanations;
}

// ---------------------------------------------------------------------------
// At-Risk Assignment Computation
// ---------------------------------------------------------------------------

/**
 * Compute at-risk assignments: assignments that cannot be fully scheduled
 * before their deadline given the available time windows.
 *
 * shortfall = remainingMinutes - availableSchedulableMinutes
 */
export function computeAtRiskAssignments(
  assignments: Assignment[],
  blocks: ScheduleBlock[],
  scheduleDate: string,
  wakeTime: string,
  sleepTime: string,
): AtRiskAssignment[] {
  const sleepMin = timeToMinutes(sleepTime);
  const atRisk: AtRiskAssignment[] = [];

  for (const assignment of assignments) {
    if (assignment.progressPercent >= 100 || assignment.remainingMinutes <= 0) continue;

    const deadlineMin = deadlineToMinutes(assignment.deadline, scheduleDate, sleepMin);
    if (deadlineMin <= 0) continue; // already past — handled as unscheduled

    // Compute how many minutes are already scheduled for this assignment
    const scheduledMinutes = blocks
      .filter(b => b.sourceType === 'assignment' && b.sourceId === assignment.id)
      .reduce((sum, b) => sum + (timeToMinutes(b.endTime) - timeToMinutes(b.startTime)), 0);

    // Compute available gap minutes before the deadline
    const gaps = findAvailableGaps(
      blocks.filter(b => b.sourceType !== 'assignment' || b.sourceId !== assignment.id),
      wakeTime,
      sleepTime,
    );

    let availableMinutes = 0;
    for (const gap of gaps) {
      const effectiveEnd = Math.min(gap.endMin, deadlineMin);
      if (effectiveEnd > gap.startMin) {
        availableMinutes += effectiveEnd - gap.startMin;
      }
    }

    // Add already-scheduled minutes to available
    availableMinutes += scheduledMinutes;

    const shortfall = assignment.remainingMinutes - availableMinutes;
    if (shortfall > 0) {
      atRisk.push({
        assignmentId: assignment.id,
        title: assignment.title,
        deadline: assignment.deadline,
        remainingMinutes: assignment.remainingMinutes,
        availableMinutes,
        shortfallMinutes: shortfall,
      });
    }
  }

  return atRisk;
}

// ---------------------------------------------------------------------------
// Main solver
// ---------------------------------------------------------------------------

/**
 * The scheduling engine's main solve function.
 *
 * Accepts a ScheduleInput and produces a ScheduleResult by running through
 * seven phases. Currently Phases 1 and 2 are implemented; Phases 3–7 are
 * placeholders for subsequent tasks.
 */
export function solve(input: ScheduleInput): ScheduleResult {
  const now = new Date();
  const planId = uuidv4();

  // Phase 1 — Place Hard Constraints (Fixed Events + Locked Blocks)
  const blocks = placeHardConstraints(
    input.fixedEvents,
    input.lockedBlocks,
    planId,
  );

  // Phase 2 — Compute Urgency & sort assignments
  const scoredAssignments = computeAndSortByUrgency(input.assignments, now);

  // Phase 3 — Place Deadline-Critical Items
  const { newBlocks: assignmentBlocks, unscheduledItems } = placeDeadlineCriticalItems(
    scoredAssignments,
    blocks,
    planId,
    input.date,
    input.preferences.wakeTime,
    input.preferences.sleepTime,
  );
  blocks.push(...assignmentBlocks);

  // Phase 4 — Insert Travel Buffers
  const allBlocks = insertTravelBuffers(
    blocks,
    input.travelRules,
    input.preferences.defaultCommuteMinutes,
    planId,
  );
  // Replace blocks array contents with the result
  blocks.length = 0;
  blocks.push(...allBlocks);

  // Phase 5 — Apply Wellbeing Constraints
  const wellbeingBlocks = applyWellbeingConstraints(
    blocks,
    input.preferences.wakeTime,
    input.preferences.sleepTime,
    input.preferences.maxDeepWorkMinutes,
    input.preferences.minBufferMinutes,
    planId,
  );
  blocks.length = 0;
  blocks.push(...wellbeingBlocks);

  // Phase 6 — Place Remaining Items (Flexible Tasks)
  const { newBlocks: flexBlocks, unscheduledItems: flexUnscheduled } = placeRemainingItems(
    input.flexibleTasks,
    blocks,
    planId,
    input.preferences.wakeTime,
    input.preferences.sleepTime,
    input.preferences.minBufferMinutes,
  );
  blocks.push(...flexBlocks);
  unscheduledItems.push(...flexUnscheduled);

  // Re-sort all blocks and re-assign sort orders
  blocks.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  blocks.forEach((block, idx) => {
    block.sortOrder = idx;
  });

  // Phase 7 — Generate Explanations
  const explanations = generateExplanations(blocks, input);

  // Compute at-risk assignments
  const atRiskAssignments = computeAtRiskAssignments(
    input.assignments,
    blocks,
    input.date,
    input.preferences.wakeTime,
    input.preferences.sleepTime,
  );

  // Build the plan
  const plan: SchedulePlan = {
    id: planId,
    userId: input.preferences.userId,
    planDate: input.date,
    version: 1,
    generatedAt: now,
    blocks,
  };

  return { plan, unscheduledItems, explanations, atRiskAssignments };
}
