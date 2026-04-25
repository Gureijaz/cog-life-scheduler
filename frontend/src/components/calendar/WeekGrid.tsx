'use client';

import { useMemo } from 'react';
import type { ScheduleBlock as ScheduleBlockType, SourceType } from '@/lib/types';

// --- Constants ---
const START_HOUR = 6;  // Grid starts at 6 AM
const END_HOUR = 24;   // Grid ends at midnight
const HOUR_HEIGHT = 60; // px per hour
const TOTAL_HOURS = END_HOUR - START_HOUR;

// --- Color map matching Google Calendar style ---
const SOURCE_COLORS: Record<SourceType, { bg: string; border: string; text: string }> = {
  fixed_event:   { bg: '#4285f4', border: '#3367d6', text: '#ffffff' },
  flexible_task: { bg: '#0b8043', border: '#0a7039', text: '#ffffff' },
  assignment:    { bg: '#f4511e', border: '#d63e17', text: '#ffffff' },
  travel_buffer: { bg: '#9e9e9e', border: '#757575', text: '#ffffff' },
};

// --- Helpers ---
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

function formatShortTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${displayH} ${period}` : `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

interface WeekGridProps {
  dates: string[];
  blocksByDate: Map<string, ScheduleBlockType[]>;
  onBlockClick?: (block: ScheduleBlockType) => void;
  today: string;
}

export default function WeekGrid({ dates, blocksByDate, onBlockClick, today }: WeekGridProps) {
  const hours = useMemo(() =>
    Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i),
  []);

  return (
    <div className="gcal-week">
      {/* Time gutter + day columns */}
      <div className="gcal-week__body">
        {/* Time labels column */}
        <div className="gcal-week__gutter">
          {hours.map((hour) => (
            <div key={hour} className="gcal-week__hour-label" style={{ height: HOUR_HEIGHT }}>
              <span>{formatHour(hour)}</span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div className="gcal-week__columns">
          {dates.map((date) => {
            const blocks = blocksByDate.get(date) ?? [];
            const isToday = date === today;

            return (
              <div key={date} className={`gcal-week__col${isToday ? ' gcal-week__col--today' : ''}`}>
                {/* Hour grid lines */}
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="gcal-week__cell"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}

                {/* Blocks positioned absolutely */}
                {blocks.map((block) => {
                  const startMin = timeToMinutes(block.startTime);
                  const endMin = timeToMinutes(block.endTime);
                  const topPx = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                  const heightPx = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 20);
                  const colors = SOURCE_COLORS[block.sourceType] ?? SOURCE_COLORS.fixed_event;

                  return (
                    <button
                      key={block.id}
                      type="button"
                      className="gcal-week__event"
                      style={{
                        top: topPx,
                        height: heightPx,
                        backgroundColor: colors.bg,
                        borderLeft: `3px solid ${colors.border}`,
                        color: colors.text,
                      }}
                      onClick={() => onBlockClick?.(block)}
                      title={`${block.title}\n${formatShortTime(block.startTime)} – ${formatShortTime(block.endTime)}`}
                    >
                      <span className="gcal-week__event-title">{block.title}</span>
                      {heightPx > 30 && (
                        <span className="gcal-week__event-time">
                          {formatShortTime(block.startTime)} – {formatShortTime(block.endTime)}
                        </span>
                      )}
                      {block.locked && <span className="gcal-week__event-lock">🔒</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
