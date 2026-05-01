import { formatInTimeZone } from 'date-fns-tz';

const BERLIN_TZ = 'Europe/Berlin';

// en-CA happens to format as YYYY-MM-DD which matches the date strings stored
// in events.date / venues etc. Use this everywhere we need "today's calendar
// date in Berlin" — never new Date().toISOString() (that's UTC).
const BERLIN_DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: BERLIN_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const BERLIN_HOUR_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: BERLIN_TZ,
  hour: '2-digit',
  hour12: false,
});

/** YYYY-MM-DD in Berlin local time. */
export function berlinDateString(d: Date = new Date()): string {
  return BERLIN_DATE_FMT.format(d);
}

/** Berlin date string offset by N days from `from`. */
export function berlinDateStringOffset(days: number, from: Date = new Date()): string {
  return berlinDateString(new Date(from.getTime() + days * 86400000));
}

/** Hour 0-23 in Berlin local time. */
export function berlinHour(d: Date = new Date()): number {
  return parseInt(BERLIN_HOUR_FMT.format(d), 10);
}

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
