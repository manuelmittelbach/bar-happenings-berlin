import { addDays, addMonths, addWeeks, format, getDate, getDay, getDaysInMonth, parse, startOfMonth } from "date-fns";

export type RecurrenceFreq = "weekly" | "biweekly" | "monthly_by_weekday";

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  // null = indefinite (no end date). Series gets extended by the
  // extend_recurring_series pg_cron job.
  until: string | null;
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDINAL_NAMES = ["", "1st", "2nd", "3rd", "4th", "5th"];

const FREQ_VALUES: RecurrenceFreq[] = ["weekly", "biweekly", "monthly_by_weekday"];

export function parseRule(recurrence: string | null | undefined): RecurrenceRule | null {
  if (!recurrence) return null;
  const parts = recurrence.split(";").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const freq = parts[0] as RecurrenceFreq;
  if (!FREQ_VALUES.includes(freq)) return null;
  const untilPart = parts.find((p) => p.startsWith("until="));
  if (!untilPart) return { freq, until: null };
  const until = untilPart.slice("until=".length);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) return null;
  return { freq, until };
}

export function formatRule(freq: RecurrenceFreq, until: string | null): string {
  return until ? `${freq};until=${until}` : freq;
}

function toIso(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function fromIso(iso: string): Date {
  return parse(iso, "yyyy-MM-dd", new Date());
}

function ordinalOfWeekdayInMonth(date: Date): number {
  return Math.ceil(getDate(date) / 7);
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): Date | null {
  const first = new Date(year, month, 1);
  const firstWeekday = getDay(first);
  const offset = (weekday - firstWeekday + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  if (day > getDaysInMonth(first)) return null;
  return new Date(year, month, day);
}

export function generateOccurrences(startDate: string, freq: RecurrenceFreq, until: string, cap = 200): string[] {
  const start = fromIso(startDate);
  const endDate = fromIso(until);
  if (endDate < start) return [];

  const dates: string[] = [];

  if (freq === "weekly" || freq === "biweekly") {
    const step = freq === "weekly" ? 1 : 2;
    let cursor = start;
    while (cursor <= endDate && dates.length < cap) {
      dates.push(toIso(cursor));
      cursor = addWeeks(cursor, step);
    }
    return dates;
  }

  // monthly_by_weekday
  const weekday = getDay(start);
  const nth = ordinalOfWeekdayInMonth(start);
  let monthCursor = startOfMonth(start);
  // safety stopper: max iteration bound
  let iter = 0;
  while (iter < 600 && dates.length < cap) {
    iter += 1;
    const candidate = nthWeekdayOfMonth(monthCursor.getFullYear(), monthCursor.getMonth(), weekday, nth);
    if (candidate && candidate >= start && candidate <= endDate) {
      dates.push(toIso(candidate));
    }
    monthCursor = addMonths(monthCursor, 1);
    if (monthCursor > endDate && (!candidate || candidate > endDate)) break;
  }
  return dates;
}

export function formatRecurrenceLabel(recurrence: string | null | undefined): string | null {
  const parsed = parseRule(recurrence);
  if (!parsed) return null;
  if (parsed.freq === "weekly") return "weekly";
  if (parsed.freq === "biweekly") return "every second week";
  return "monthly";
}

export function describeRule(startDate: string, freq: RecurrenceFreq): string {
  const start = fromIso(startDate);
  const weekdayName = WEEKDAY_NAMES[getDay(start)];
  if (freq === "weekly") return `every ${weekdayName}`;
  if (freq === "biweekly") return `every 2 weeks on ${weekdayName}`;
  const nth = ordinalOfWeekdayInMonth(start);
  return `${ORDINAL_NAMES[nth] ?? `${nth}th`} ${weekdayName} of each month`;
}

export function defaultUntil(startDate: string): string {
  const start = fromIso(startDate);
  return toIso(addMonths(start, 6));
}

export function addOneDay(iso: string): string {
  return toIso(addDays(fromIso(iso), 1));
}
