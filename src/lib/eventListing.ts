import type { BarlinEvent } from "@/types/event";
import { isEventStillOnline } from "@/lib/eventStatus";
import { berlinDateString, berlinDateStringOffset } from "@/lib/dateFormat";

// The "listable event" — given an event and `now`, this module answers the
// three questions every list/map/detail view kept re-deriving on its own:
//   - isShowable:       should the event still appear at all?
//   - resolveActiveDay: which concrete day does the day-strip filter mean?
//   - compare*:         how do two events sort against each other?
// Keeping them here means Index, MapPage, BarDetail and the venue directory
// can't drift, and the fiddly parts (cross-midnight cutoffs via
// isEventStillOnline, the timeless-sort sentinel) are defined and tested once.

// Sentinel start time for events with no known start: it sorts after every
// real "HH:MM", so timeless events sink to the end of their day. Previously
// copy-pasted as the bare string "99:99" at ~a dozen call sites.
const TIMELESS = "99:99";

// The day strip's visible horizon: today+VISIBLE_HORIZON is the last
// selectable day (7 days total: Tonight, Tomorrow, 5 more). Deliberately
// shorter than the 14-day scrape window — events beyond it stay hidden until
// they roll into the strip (see CONTEXT.md "Sichtfenster").
export const VISIBLE_HORIZON = 6;

// Should this event still be shown in a public list? Canceled events drop out,
// and already-over events fall off via isEventStillOnline (endTime, or
// startTime+90min, or the 22:00 fallback for unknown start times). This is the
// `status !== "canceled" && isEventStillOnline(e)` pair that BarDetail, the
// landing hero and the venue "tonight" map each spelled out inline.
export function isShowable(
  event: Pick<BarlinEvent, "date" | "startTime" | "endTime" | "status">,
  now: Date = new Date(),
): boolean {
  return event.status !== "canceled" && isEventStillOnline(event, now);
}

// Resolve the stored day-filter value to the concrete Berlin date it means.
// "Tonight" (the default) and "Tomorrow" are named values — they stay
// relative, so a session kept open across midnight still means "today".
// A concrete "YYYY-MM-DD" inside the visible strip resolves to itself;
// anything else (past, beyond the strip, legacy "Upcoming") silently falls
// back to today — the Tonight view, no error surface. Filter with
// `e.date === resolveActiveDay(activeDate, now)`.
export function resolveActiveDay(
  activeDate: string,
  now: Date = new Date(),
): string {
  const today = berlinDateString(now);
  if (activeDate === "Tomorrow") return berlinDateStringOffset(1, now);
  const horizon = berlinDateStringOffset(VISIBLE_HORIZON, now);
  if (/^\d{4}-\d{2}-\d{2}$/.test(activeDate) && activeDate >= today && activeDate <= horizon) {
    return activeDate;
  }
  return today;
}

// Start-time sort key with the timeless sentinel baked in.
function startKey(e: Pick<BarlinEvent, "startTime">): string {
  return e.startTime || TIMELESS;
}

// Within a single day: earliest start first, timeless events last.
export function compareByStartTime(
  a: Pick<BarlinEvent, "startTime">,
  b: Pick<BarlinEvent, "startTime">,
): number {
  return startKey(a).localeCompare(startKey(b));
}

// Across days: date ascending, then start time (timeless last within a day).
export function compareChronological(
  a: Pick<BarlinEvent, "date" | "startTime">,
  b: Pick<BarlinEvent, "date" | "startTime">,
): number {
  const d = a.date.localeCompare(b.date);
  if (d !== 0) return d;
  return compareByStartTime(a, b);
}
