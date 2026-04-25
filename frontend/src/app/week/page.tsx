'use client';

import { useMemo, useState } from 'react';
import type { ScheduleBlock as ScheduleBlockType } from '@/lib/types';
import { useWeekSchedule } from '@/hooks/useSchedule';
import WeekGrid from '@/components/calendar/WeekGrid';
import BlockDetail from '@/components/calendar/BlockDetail';
import { getWeekStartDate, getTodayDate } from '@/lib/utils';

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

function getDayLabel(dateStr: string): { dayName: string; dayNum: number } {
  const d = new Date(dateStr + 'T00:00:00');
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  return { dayName, dayNum: d.getDate() };
}

function getMonthYear(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function WeekPage() {
  const today = getTodayDate();
  const weekStart = getWeekStartDate();
  const { plans, loading, error } = useWeekSchedule(weekStart);
  const [selectedBlock, setSelectedBlock] = useState<ScheduleBlockType | null>(null);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

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
    <div className="gcal-page">
      {/* Header bar */}
      <header className="gcal-header">
        <h1 className="gcal-header__title">{getMonthYear(weekDates[0])}</h1>
        <div className="gcal-header__legend">
          <span className="gcal-legend__item"><span className="gcal-legend__dot" style={{ background: '#4285f4' }} /> Events</span>
          <span className="gcal-legend__item"><span className="gcal-legend__dot" style={{ background: '#0b8043' }} /> Tasks</span>
          <span className="gcal-legend__item"><span className="gcal-legend__dot" style={{ background: '#f4511e' }} /> Assignments</span>
          <span className="gcal-legend__item"><span className="gcal-legend__dot" style={{ background: '#9e9e9e' }} /> Travel</span>
        </div>
      </header>

      {/* Day headers */}
      <div className="gcal-day-headers">
        <div className="gcal-day-headers__gutter" />
        <div className="gcal-day-headers__cols">
          {weekDates.map((date) => {
            const { dayName, dayNum } = getDayLabel(date);
            const isToday = date === today;
            return (
              <div key={date} className={`gcal-day-headers__col${isToday ? ' gcal-day-headers__col--today' : ''}`}>
                <span className="gcal-day-headers__name">{dayName}</span>
                <span className={`gcal-day-headers__num${isToday ? ' gcal-day-headers__num--today' : ''}`}>
                  {dayNum}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {loading && <p className="gcal-status">Loading week schedule…</p>}
      {error && <p className="gcal-status gcal-status--error">{error}</p>}

      {/* Time grid */}
      <WeekGrid
        dates={weekDates}
        blocksByDate={blocksByDate}
        onBlockClick={handleBlockClick}
        today={today}
      />

      {/* Detail panel */}
      {selectedBlock && (
        <BlockDetail
          block={selectedBlock}
          onClose={() => setSelectedBlock(null)}
        />
      )}
    </div>
  );
}
