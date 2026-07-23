import type { BarlinEvent } from "@/types/event";
import { isEventStillOnline } from "@/lib/eventStatus";
import { berlinDateString, berlinDateStringOffset } from "@/lib/dateFormat";

// The "listable event" — given an event and `now`, this module answers the
// three questions every list/map/detail view kept re-deriving on its own:
//   - isShowable: should the event still appear at all?
//   - daySlot:    which day bucket (today / tomorrow / upcoming …) is it in?
//   - compare*:   how do two events sort against each other?
// Keeping them here means Index, MapPage, BarDetail and the venue directory
// can't drift, and the fiddly parts (cross-midnight cutoffs via
// isEventStillOnline, the timeless-sort sentinel) are defined and tested once.

// Sentinel start time for events with no known start: it sorts after every
// real "HH:MM", so timeless events sink to the end of their day. Previously
// copy-pasted as the bare string "99:99" at ~a dozen call sites.
const TIMELESS = "99:99";

// How many days ahead "Upcoming" reaches: today+UPCOMING_HORIZON is the last
// day still counted as upcoming (mirrors the +14 cutoff Index/MapPage used).
export const UPCOMING_HORIZON = 14;

export type DaySlot = "past" | "today" | "tomorrow" | "upcoming" | "beyond";

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

// Which day bucket the event's date falls in, relative to `now` (Berlin time).
// Drives the Tonight / Tomorrow / Upcoming day filter shared by Index and
// MapPage — filter with `daySlot(e, now) === slot`.
export function daySlot(
  event: Pick<BarlinEvent, "date">,
  now: Date = new Date(),
): DaySlot {
  const today = berlinDateString(now);
  const tomorrow = berlinDateStringOffset(1, now);
  const cutoff = berlinDateStringOffset(UPCOMING_HORIZON, now);
  if (event.date < today) return "past";
  if (event.date === today) return "today";
  if (event.date === tomorrow) return "tomorrow";
  if (event.date <= cutoff) return "upcoming";
  return "beyond";
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
