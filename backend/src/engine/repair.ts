import type { ScheduleBlock, SchedulePlan } from '../types/domain';
import type {
  ChangeSummary,
  RepairResult,
  ScheduleChange,
  ScheduleInput,
} from '../types/engine';
import { solve } from './solver';
import { timeToMinutes } from './solver';

/**
 * Build a ChangeSummary by diffing old blocks against new blocks.
 *
 * - "added": blocks in newBlocks whose id is not in oldBlocks
 * - "removed": blocks in oldBlocks whose id is not in newBlocks
 * - "moved": blocks present in both but with a different startTime
 */
export function diffPlans(
  oldBlocks: ScheduleBlock[],
  newBlocks: ScheduleBlock[],
): ChangeSummary {
  const oldMap = new Map(oldBlocks.map((b) => [b.id, b]));
  const newMap = new Map(newBlocks.map((b) => [b.id, b]));

  const added: string[] = [];
  const removed: string[] = [];
  const moved: { blockId: string; oldStart: string; newStart: string }[] = [];

  for (const nb of newBlocks) {
    const ob = oldMap.get(nb.id);
    if (!ob) {
      added.push(nb.id);
    } else if (ob.startTime !== nb.startTime) {
      moved.push({ blockId: nb.id, oldStart: ob.startTime, newStart: nb.startTime });
    }
  }

  for (const ob of oldBlocks) {
    if (!newMap.has(ob.id)) {
      removed.push(ob.id);
    }
  }

  return { moved, added, removed };
}

/**
 * Apply a ScheduleChange to a ScheduleInput, returning a modified copy.
 *
 * - 'add': the item described in change.details is already expected to be
 *   present in the input arrays (caller is responsible for adding it).
 * - 'remove': filters out the item matching change.sourceId from the
 *   appropriate input array.
 * - 'modify': the updated item is already expected to be in the input
 *   arrays (caller passes the updated ScheduleInput).
 */
export function applyChange(
  input: ScheduleInput,
  change: ScheduleChange,
): ScheduleInput {
  if (change.type === 'remove' && change.sourceId) {
    const id = change.sourceId;
    switch (change.sourceType) {
      case 'fixed_event':
        return { ...input, fixedEvents: input.fixedEvents.filter((e) => e.id !== id) };
      case 'flexible_task':
        return { ...input, flexibleTasks: input.flexibleTasks.filter((t) => t.id !== id) };
      case 'assignment':
        return { ...input, assignments: input.assignments.filter((a) => a.id !== id) };
    }
  }
  // For 'add' and 'modify', the caller already updated the input arrays
  return input;
}

/**
 * Schedule repair engine.
 *
 * Accepts an existing plan, a change description, and the (already-updated)
 * schedule input. Produces a new plan that:
 *   1. Preserves all locked blocks in their exact positions
 *   2. Applies the change (add / modify / remove)
 *   3. Re-solves with locked blocks carried through
 *   4. Minimises disruption via gap-first insertion (handled by the solver)
 *   5. Returns a ChangeSummary comparing old and new plans
 */
export function repair(
  existing: SchedulePlan,
  change: ScheduleChange,
  input: ScheduleInput,
): RepairResult {
  // 1. Collect locked blocks from the existing plan — these are immovable
  const lockedBlocks = existing.blocks.filter((b) => b.locked);

  // 2. Apply the change to the input (only matters for 'remove')
  const updatedInput = applyChange(input, change);

  // 3. Build solver input with locked blocks preserved
  const solverInput: ScheduleInput = {
    ...updatedInput,
    lockedBlocks,
  };

  // 4. Re-solve
  const solveResult = solve(solverInput);

  // 5. Diff old plan vs new plan to build the change summary
  const changeSummary = diffPlans(existing.blocks, solveResult.plan.blocks);

  return {
    ...solveResult,
    changeSummary,
  };
}
