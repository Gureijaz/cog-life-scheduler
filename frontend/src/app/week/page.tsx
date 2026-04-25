'use client';

import { useMemo, useState } from 'react';
import type { ScheduleBlock as ScheduleBlockType } from '@/lib/types';
import { useWeekSchedule } from '@/hooks/useSchedule';
import ScheduleBlock from '@/components/calendar/ScheduleBlock';
import FreeTimeSlot from '@/components/calendar/FreeTimeSlot';
import BlockDetail from '@/components/calendar/BlockDetail';
import {
  getWeekStartDate,
  formatDateShort,
  getDayOfWeek,
} from '@/lib/utils';

/** Generate 7 consecutive YYYY-MM-DD strings starting from `start`. */
function getWeekDates(start: string): string[] {
  const dates: string[] = [];
  const d = new Date(start + 'T00:00:00');
  for (let i = 0; i < 7; i++) {
    const copy = new Date(d);
    copy.setDate(d.getDate() + i);
    dates.push(
      `${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, '0')}-${String(copy.getDate()).padStart(2, '0')}`,
    );
  }
  return dates;
}

export default function WeekPage() {
  const weekStart = getWeekStartDate();
  const { plans, loading, error } = useWeekSchedule(weekStart);
  const [selectedBlock, setSelectedBlock] = useState<ScheduleBlockType | null>(null);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  /** Map planDate → sorted blocks */
  const blocksByDate = useMemo(() => {
    const map = new Map<string, ScheduleBlockType[]>();
    for (const plan of plans) {
      const sorted = [...plan.blocks].sort((a, b) => a.sortOrder - b.sortOrder);
      map.set(plan.planDate, sorted);
    }
    return map;
  }, [plans]);

  const handleBlockClick = (block: ScheduleBlockType) => {
    setSelectedBlock((prev) => (prev?.id === block.id ? null : block));
  };

  return (
    <div className="week-view">
      <header className="week-view__header">
        <h1 className="week-view__title">Week View</h1>
      </header>

      {loading && <p className="week-view__status">Loading week schedule…</p>}
      {error && <p className="week-view__status week-view__status--error">{error}</p>}

      <div className="week-view__grid">
        {weekDates.map((date) => {
          const dayBlocks = blocksByDate.get(date) ?? [];
          return (
            <div key={date} className="week-view__day">
              <div className="week-view__day-header">
                <span className="week-view__day-name">{getDayOfWeek(date)}</span>
                <span className="week-view__day-date">{formatDateShort(date)}</span>
              </div>
              <div className="week-view__day-blocks">
                {dayBlocks.length === 0 && (
                  <FreeTimeSlot startTime="08:00" endTime="22:00" />
                )}
                {dayBlocks.map((block) => (
                  <ScheduleBlock key={block.id} block={block} onClick={handleBlockClick} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selectedBlock && (
        <BlockDetail
          block={selectedBlock}
          onClose={() => setSelectedBlock(null)}
        />
      )}
    </div>
  );
}
