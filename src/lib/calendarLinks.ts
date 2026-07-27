import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

const BERLIN_TZ = "Europe/Berlin";

/** Fallback duration when an event has no explicit end time. */
const DEFAULT_DURATION_MIN = 120;

/**
 * The event fields needed to build a calendar entry. Times are Berlin
 * wall-clock (no stored timezone) — see `date`/`startTime` in BarlinEvent.
 */
export interface CalendarEventInput {
  /** Stable id used for the ICS UID. */
  uid: string;
  title: string;
  venue: string;
  address: string;
  /** YYYY-MM-DD, Berlin local calendar date. */
  date: string;
  /** HH:MM, Berlin wall-clock. */
  startTime: string;
  /** HH:MM, Berlin wall-clock. Optional — defaults to start + 2h. */
  endTime?: string | null;
  /** Public Inside Bars event page — the only thing we put in the body. */
  pageUrl: string;
}

/** YYYY-MM-DD one calendar day after the given date. */
function nextDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → "YYYYMMDD" — the date-only stamp for all-day entries. */
function dateStamp(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

/**
 * An event with no usable start time (missing, null, or whitespace-only)
 * can't be a precise timed calendar entry. We render it as an all-day entry
 * instead — which also avoids the `fromZonedTime("…T:00")` → Invalid Date →
 * RangeError that used to throw during render and blank the EventDetail page.
 */
function isAllDay(ev: CalendarEventInput): boolean {
  return !ev.startTime || ev.startTime.trim() === "";
}

/** Format a UTC instant as an ICS/Google "YYYYMMDDTHHMMSSZ" stamp. */
function utcStamp(instant: Date): string {
  return formatInTimeZone(instant, "UTC", "yyyyMMdd'T'HHmmss'Z'");
}

/**
 * Resolve a Berlin wall-clock event into UTC start/end instants.
 * If `endTime` is missing, end = start + 2h. If `endTime` is at or before
 * `startTime` (a night that crosses midnight, e.g. 23:00–02:00), the end
 * rolls to the next calendar day.
 */
function resolveInstants(ev: CalendarEventInput): { start: Date; end: Date } {
  const start = fromZonedTime(`${ev.date}T${ev.startTime}:00`, BERLIN_TZ);

  let end: Date;
  if (ev.endTime) {
    end = fromZonedTime(`${ev.date}T${ev.endTime}:00`, BERLIN_TZ);
    if (end <= start) {
      end = fromZonedTime(`${nextDay(ev.date)}T${ev.endTime}:00`, BERLIN_TZ);
    }
  } else {
    end = new Date(start.getTime() + DEFAULT_DURATION_MIN * 60000);
  }

  return { start, end };
}

/** Location line — "Venue, Address" (Venue dropped if empty). */
function locationLine(ev: CalendarEventInput): string {
  return [ev.venue, ev.address].filter(Boolean).join(", ");
}

/**
 * A Google Calendar "create event" link. Opens the prefilled event form in the
 * user's Google account (web or app) — no download involved.
 */
export function googleCalendarUrl(ev: CalendarEventInput): string {
  // All-day: Google takes a date-only range "YYYYMMDD/YYYYMMDD" with the end
  // date EXCLUSIVE, so a single-day event ends on the next calendar day.
  let dates: string;
  if (isAllDay(ev)) {
    dates = `${dateStamp(ev.date)}/${dateStamp(nextDay(ev.date))}`;
  } else {
    const { start, end } = resolveInstants(ev);
    dates = `${utcStamp(start)}/${utcStamp(end)}`;
  }
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates,
    location: locationLine(ev),
    details: ev.pageUrl,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Escape a value for an ICS TEXT field (RFC 5545 §3.3.11). */
function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * A complete VCALENDAR document for a single event. Downloaded as a .ics file;
 * iOS/macOS open it in Apple Calendar, desktops hand it to the default calendar
 * app (Outlook, Thunderbird, …). Lines are CRLF-joined per spec.
 */
export function buildIcs(ev: CalendarEventInput): string {
  // DTSTAMP is "when this file was made"; we need a stable, deterministic
  // instant. DTSTART/DTEND then describe the event itself. All-day events use
  // date-only VALUE=DATE properties (end date EXCLUSIVE → next day) and, having
  // no valid start instant, anchor DTSTAMP to Berlin midnight of the event's
  // date. Timed events resolve once and reuse the instants for all three.
  let dtstamp: string;
  let dtStartEnd: string[];
  if (isAllDay(ev)) {
    dtstamp = utcStamp(fromZonedTime(`${ev.date}T00:00:00`, BERLIN_TZ));
    dtStartEnd = [
      `DTSTART;VALUE=DATE:${dateStamp(ev.date)}`,
      `DTEND;VALUE=DATE:${dateStamp(nextDay(ev.date))}`,
    ];
  } else {
    const { start, end } = resolveInstants(ev);
    dtstamp = utcStamp(start);
    dtStartEnd = [`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`];
  }
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Inside Bars//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ev.uid}@insidebars.co`,
    `DTSTAMP:${dtstamp}`,
    ...dtStartEnd,
    `SUMMARY:${escapeIcsText(ev.title)}`,
    `LOCATION:${escapeIcsText(locationLine(ev))}`,
    // The event link lives only in the notes — it's visible and auto-linked in
    // every client, whereas the ICS URL property is inconsistently surfaced
    // (Google drops it on import). One place, no redundancy.
    `DESCRIPTION:${escapeIcsText(ev.pageUrl)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

/** A safe .ics filename derived from the event title. */
export function icsFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return `${slug || "event"}.ics`;
}
