'use client';

import type { ScheduleBlock as ScheduleBlockType, SourceType } from '@/lib/types';
import { formatTimeRange } from '@/lib/utils';

/** Human-readable labels for source types */
const SOURCE_LABELS: Record<SourceType, string> = {
  fixed_event: 'Event',
  flexible_task: 'Task',
  assignment: 'Assignment',
  travel_buffer: 'Travel',
};

/** CSS class suffix per source type — maps to --color-* variables in globals.css */
const SOURCE_CLASS: Record<SourceType, string> = {
  fixed_event: 'fixed-event',
  flexible_task: 'flexible-task',
  assignment: 'assignment',
  travel_buffer: 'travel-buffer',
};

interface ScheduleBlockProps {
  block: ScheduleBlockType;
  onClick?: (block: ScheduleBlockType) => void;
}

export default function ScheduleBlock({ block, onClick }: ScheduleBlockProps) {
  const colorClass = SOURCE_CLASS[block.sourceType] ?? 'fixed-event';
  const label = SOURCE_LABELS[block.sourceType] ?? block.sourceType;

  return (
    <button
      type="button"
      className={`schedule-block schedule-block--${colorClass}`}
      onClick={() => onClick?.(block)}
      aria-label={`${block.title}, ${formatTimeRange(block.startTime, block.endTime)}${block.locked ? ', locked' : ''}`}
    >
      <div className="schedule-block__time">
        {formatTimeRange(block.startTime, block.endTime)}
      </div>

      <div className="schedule-block__body">
        <span className="schedule-block__title">{block.title}</span>

        <span className="schedule-block__meta">
          <span className="schedule-block__badge">{label}</span>

          {block.locked && (
            <span className="schedule-block__lock" aria-hidden="true" title="Locked">
              {/* Simple SVG lock icon */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
          )}
        </span>
      </div>
    </button>
  );
}
