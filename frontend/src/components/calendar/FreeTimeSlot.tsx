'use client';

import { formatTimeRange } from '@/lib/utils';

interface FreeTimeSlotProps {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

export default function FreeTimeSlot({ startTime, endTime }: FreeTimeSlotProps) {
  return (
    <div
      className="free-time-slot"
      role="status"
      aria-label={`Free time from ${startTime} to ${endTime}`}
    >
      <span className="free-time-slot__range">
        {formatTimeRange(startTime, endTime)}
      </span>
      <span className="free-time-slot__label">Free</span>
    </div>
  );
}
