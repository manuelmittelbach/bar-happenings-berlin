import { formatInTimeZone } from 'date-fns-tz';

const BERLIN_TZ = 'Europe/Berlin';

/**
 * Format a date string (YYYY-MM-DD) to European format in English.
 * Parses as UTC and displays as UTC so the calendar date is timezone-stable.
 */
export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatDateWithDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Format an ISO timestamp as a Berlin-local calendar date.
 * Use for moments-in-time (signups, approvals) — these should always display
 * as the date they happened in Berlin, regardless of the viewer's location.
 */
export function formatTimestampAsBerlinDate(iso: string): string {
  return formatInTimeZone(iso, BERLIN_TZ, 'd MMM yyyy');
}
