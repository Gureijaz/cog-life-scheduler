/**
 * Date/time formatting utilities for the Cog Life Scheduler frontend.
 */

/**
 * Format a HH:mm time string to a human-readable 12-hour format.
 * e.g. "14:30" → "2:30 PM"
 */
export function formatTime(time: string): string {
  const [hoursStr, minutesStr] = time.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);

  if (isNaN(hours) || isNaN(minutes)) return time;

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const displayMinutes = minutes.toString().padStart(2, '0');

  return `${displayHours}:${displayMinutes} ${period}`;
}

/**
 * Format a YYYY-MM-DD date string to a human-readable format.
 * e.g. "2025-01-20" → "January 20, 2025"
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return dateStr;

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format a YYYY-MM-DD date string to a short format.
 * e.g. "2025-01-20" → "Jan 20"
 */
export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return dateStr;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date string relative to today.
 * Returns "Today", "Tomorrow", "Yesterday", or the formatted date.
 */
export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return dateStr;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = date.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';

  return formatDate(dateStr);
}

/**
 * Format a duration in minutes to a human-readable string.
 * e.g. 90 → "1h 30m", 45 → "45m", 120 → "2h"
 */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Format a time range from two HH:mm strings.
 * e.g. ("09:00", "10:30") → "9:00 AM – 10:30 AM"
 */
export function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatTime(startTime)} – ${formatTime(endTime)}`;
}

/**
 * Get the day of week name from a YYYY-MM-DD date string.
 * e.g. "2025-01-20" → "Monday"
 */
export function getDayOfWeek(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return '';

  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Get today's date as a YYYY-MM-DD string.
 */
export function getTodayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Get the start of the current week (Monday) as a YYYY-MM-DD string.
 */
export function getWeekStartDate(dateStr?: string): string {
  const date = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  const day = date.getDay();
  // Adjust so Monday = 0
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Compute the duration in minutes between two HH:mm time strings.
 */
export function getBlockDurationMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);

  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;

  return (eh * 60 + em) - (sh * 60 + sm);
}

/**
 * Format an ISO datetime string to a readable date and time.
 * e.g. "2025-01-20T14:30:00Z" → "January 20, 2025 at 2:30 PM"
 */
export function formatDateTime(isoStr: string): string {
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return isoStr;

  const dateFormatted = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const displayMinutes = minutes.toString().padStart(2, '0');

  return `${dateFormatted} at ${displayHours}:${displayMinutes} ${period}`;
}
