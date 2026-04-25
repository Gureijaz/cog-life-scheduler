'use client';

import { useMemo, useState, useCallback } from 'react';
import type { ScheduleBlock as ScheduleBlockType } from '@/lib/types';
import { useWeekSchedule } from '@/hooks/useSchedule';
import { useToast } from '@/hooks/useToast';
import { scheduleBlocks } from '@/lib/api';
import WeekGrid from '@/components/calendar/WeekGrid';
import BlockDetail from '@/components/calendar/BlockDetail';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import Modal from '@/components/ui/Modal';
import EventForm from '@/components/events/EventForm';
import TaskForm from '@/components/tasks/TaskForm';
import { getWeekStartDate, getTodayDate } from '@/lib/utils';
import DynamicScheduleViz3D from '@/components/three/DynamicScheduleViz3D';

function addWeeks(dateStr: string, weeks: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + weeks * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  const [today] = useState(() => getTodayDate());
  const [weekStart, setWeekStart] = useState(() => getWeekStartDate());
  const { plans, loading, error, refresh } = useWeekSchedule(weekStart);
  const { addToast } = useToast();
  const [selectedBlock, setSelectedBlock] = useState<ScheduleBlockType | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [view3D, setView3D] = useState(false);

  const goToPrevWeek = useCallback(() => setWeekStart((ws) => addWeeks(ws, -1)), []);
  const goToNextWeek = useCallback(() => setWeekStart((ws) => addWeeks(ws, 1)), []);
  const goToCurrentWeek = useCallback(() => setWeekStart(getWeekStartDate()), []);

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

  const handleLockToggle = async (blockId: string, locked: boolean) => {
    try {
      if (locked) {
        await scheduleBlocks.unlock(blockId);
      } else {
        await scheduleBlocks.lock(blockId);
      }
      setSelectedBlock((prev) =>
        prev && prev.id === blockId ? { ...prev, locked: !locked } : prev,
      );
    } catch {
      addToast('error', `Failed to ${locked ? 'unlock' : 'lock'} block`);
    }
  };

  return (
    <div className="gcal-page">
      <header className="gcal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <button className="btn btn--secondary btn--sm" onClick={goToPrevWeek} aria-label="Previous week">←</button>
          <h1 className="gcal-header__title">{getMonthYear(weekDates[0])}</h1>
          <button className="btn btn--secondary btn--sm" onClick={goToNextWeek} aria-label="Next week">→</button>
          <button className="btn btn--secondary btn--sm" onClick={goToCurrentWeek}>Today</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <button
            className={`btn ${view3D ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setView3D(!view3D)}
          >
            {view3D ? '2D View' : '3D View'}
          </button>
          <button className="btn btn--secondary" onClick={() => setShowEventModal(true)}>
            Add Event
          </button>
          <button className="btn btn--secondary" onClick={() => setShowTaskModal(true)}>
            Add Task
          </button>
          <div className="gcal-header__legend">
            <span className="gcal-legend__item"><span className="gcal-legend__dot" style={{ background: 'var(--color-fixed-event)' }} /> Events</span>
            <span className="gcal-legend__item"><span className="gcal-legend__dot" style={{ background: 'var(--color-flexible-task)' }} /> Tasks</span>
            <span className="gcal-legend__item"><span className="gcal-legend__dot" style={{ background: 'var(--color-assignment)' }} /> Assignments</span>
            <span className="gcal-legend__item"><span className="gcal-legend__dot" style={{ background: 'var(--color-travel-buffer)' }} /> Travel</span>
          </div>
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

      {loading && (
        <div style={{ display: 'flex', gap: '8px', padding: '16px' }}>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} style={{ flex: 1 }}>
              <LoadingSkeleton variant="column" />
            </div>
          ))}
        </div>
      )}
      {error && <p className="gcal-status gcal-status--error">{error}</p>}

      {!loading && !view3D && (
        <WeekGrid
          dates={weekDates}
          blocksByDate={blocksByDate}
          onBlockClick={handleBlockClick}
          today={today}
        />
      )}

      {!loading && view3D && (
        <DynamicScheduleViz3D
          blocksByDate={blocksByDate}
          dates={weekDates}
          onBlockSelect={handleBlockClick}
          active={view3D}
        />
      )}

      {selectedBlock && (
        <BlockDetail
          block={selectedBlock}
          onClose={() => setSelectedBlock(null)}
          onLockToggle={handleLockToggle}
        />
      )}

      <Modal open={showEventModal} onClose={() => setShowEventModal(false)} ariaLabel="Create event">
        <EventForm
          onSaved={() => { setShowEventModal(false); refresh(); }}
          onCancel={() => setShowEventModal(false)}
        />
      </Modal>

      <Modal open={showTaskModal} onClose={() => setShowTaskModal(false)} ariaLabel="Create task">
        <TaskForm
          onSaved={() => { setShowTaskModal(false); refresh(); }}
          onCancel={() => setShowTaskModal(false)}
        />
      </Modal>
    </div>
  );
}
