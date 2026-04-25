'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ScheduleBlock, SchedulePlan, Explanation, UnscheduledItem, AtRiskAssignment, ChangeSummary } from '@/lib/types';
import { schedules, scheduleBlocks, ApiRequestError } from '@/lib/api';
import type { ScheduleResult, RepairResult } from '@/lib/api';

interface UseScheduleReturn {
  /** Schedule plan for the requested date (null while loading or if none exists) */
  plan: SchedulePlan | null;
  /** Ordered blocks for the plan */
  blocks: ScheduleBlock[];
  /** True while the initial fetch is in-flight */
  loading: boolean;
  /** Error message if the fetch failed */
  error: string | null;
  /** Items that could not be scheduled */
  unscheduledItems: UnscheduledItem[];
  /** Assignments at risk of missing their deadline */
  atRiskAssignments: AtRiskAssignment[];
  /** Change summary from the last repair operation */
  changeSummary: ChangeSummary | null;
  /** True while a generate or repair operation is in-flight */
  generating: boolean;
  /** Re-fetch the plan for the current date */
  refresh: () => Promise<void>;
  /** Generate a new schedule plan for the current date */
  generateSchedule: () => Promise<void>;
  /** Repair the current schedule plan */
  repairSchedule: (change?: unknown) => Promise<void>;
  /** Lock a block and update local state */
  lockBlock: (blockId: string) => Promise<void>;
  /** Unlock a block and update local state */
  unlockBlock: (blockId: string) => Promise<void>;
  /** Clear the change summary */
  clearChangeSummary: () => void;
}

export function useSchedule(date: string): UseScheduleReturn {
  const [plan, setPlan] = useState<SchedulePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unscheduledItems, setUnscheduledItems] = useState<UnscheduledItem[]>([]);
  const [atRiskAssignments, setAtRiskAssignments] = useState<AtRiskAssignment[]>([]);
  const [changeSummary, setChangeSummary] = useState<ChangeSummary | null>(null);
  const [generating, setGenerating] = useState(false);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await schedules.get(date);
      setPlan(result);
    } catch (err: unknown) {
      // 404 = no schedule yet, not an error
      if (err instanceof ApiRequestError && err.status === 404) {
        setPlan(null);
      } else {
        const message = err instanceof Error ? err.message : 'Failed to load schedule';
        setError(message);
        setPlan(null);
      }
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const applyScheduleResult = useCallback((result: ScheduleResult) => {
    setPlan(result.plan);
    setUnscheduledItems(result.unscheduledItems ?? []);
    const explanations = result.explanations ?? {};
    // Extract at-risk assignments from the result if present
    setAtRiskAssignments((result as ScheduleResult & { atRiskAssignments?: AtRiskAssignment[] }).atRiskAssignments ?? []);
  }, []);

  const generateSchedule = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setChangeSummary(null);
    try {
      const result = await schedules.generate(date);
      applyScheduleResult(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate schedule';
      setError(message);
    } finally {
      setGenerating(false);
    }
  }, [date, applyScheduleResult]);

  const repairSchedule = useCallback(async (change?: unknown) => {
    if (!plan) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await schedules.repair(plan.id, change);
      applyScheduleResult(result);
      setChangeSummary(result.changeSummary ?? null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to repair schedule';
      setError(message);
    } finally {
      setGenerating(false);
    }
  }, [plan, applyScheduleResult]);

  const lockBlock = useCallback(async (blockId: string) => {
    const updated = await scheduleBlocks.lock(blockId);
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map((b) => (b.id === updated.id ? { ...b, locked: true } : b)),
      };
    });
  }, []);

  const unlockBlock = useCallback(async (blockId: string) => {
    const updated = await scheduleBlocks.unlock(blockId);
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map((b) => (b.id === updated.id ? { ...b, locked: false } : b)),
      };
    });
  }, []);

  const clearChangeSummary = useCallback(() => {
    setChangeSummary(null);
  }, []);

  const blocks = plan?.blocks
    ? [...plan.blocks].sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  return {
    plan, blocks, loading, error,
    unscheduledItems, atRiskAssignments, changeSummary, generating,
    refresh: fetchPlan, generateSchedule, repairSchedule,
    lockBlock, unlockBlock, clearChangeSummary,
  };
}

interface UseWeekScheduleReturn {
  plans: SchedulePlan[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useWeekSchedule(startDate: string): UseWeekScheduleReturn {
  const [plans, setPlans] = useState<SchedulePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeek = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await schedules.getWeek(startDate);
      setPlans(Array.isArray(result) ? result : []);
    } catch (err: unknown) {
      if (err instanceof ApiRequestError && err.status === 404) {
        setPlans([]);
      } else {
        const message = err instanceof Error ? err.message : 'Failed to load week schedule';
        setError(message);
        setPlans([]);
      }
    } finally {
      setLoading(false);
    }
  }, [startDate]);

  useEffect(() => {
    fetchWeek();
  }, [fetchWeek]);

  return { plans, loading, error, refresh: fetchWeek };
}

export function useExplanation(blockId: string | null) {
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!blockId) {
      setExplanation(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    scheduleBlocks
      .getExplanation(blockId)
      .then((result) => {
        if (!cancelled) setExplanation(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load explanation');
          setExplanation(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [blockId]);

  return { explanation, loading, error };
}
