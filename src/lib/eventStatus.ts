import type { BarlinEvent } from "@/types/event";

// Event "disappears from the main page" moment: later of 06:00 next day and real endTime.
// 06:00 next day acts as a minimum floor so late-night scrollers still see yesterday's events;
// if the event's real endTime extends past that (e.g. 12:00–11:00 next day), the endTime wins.
export function isEventStillOnline(
  event: Pick<BarlinEvent, "date" | "startTime" | "endTime">,
  now: Date = new Date(),
): boolean {
  const [y, mo, d] = event.date.split("-").map(Number);
  if (!y || !mo || !d) return false;
  const floor = new Date(y, mo - 1, d + 1, 6, 0, 0, 0);
  if (event.endTime) {
    const [h, m] = event.endTime.split(":").map(Number);
    if (!Number.isNaN(h) && !Number.isNaN(m)) {
      const dayOffset = endsNextDay(event.startTime, event.endTime) ? 1 : 0;
      const realEnd = new Date(y, mo - 1, d + dayOffset, h, m, 0, 0);
      const cutoff = realEnd.getTime() > floor.getTime() ? realEnd : floor;
      return now.getTime() < cutoff.getTime();
    }
  }
  return now.getTime() < floor.getTime();
}

// Event started: startTime on event.date has been reached.
export function hasEventStarted(
  event: Pick<BarlinEvent, "date" | "startTime">,
  now: Date = new Date(),
): boolean {
  const [y, mo, d] = event.date.split("-").map(Number);
  const [h, m] = event.startTime.split(":").map(Number);
  if (!y || !mo || !d || Number.isNaN(h) || Number.isNaN(m)) return false;
  const start = new Date(y, mo - 1, d, h, m, 0, 0);
  return now.getTime() >= start.getTime();
}

// True if endTime < startTime on the "HH:MM" clock — event ends the next day.
export function endsNextDay(startTime?: string, endTime?: string): boolean {
  if (!startTime || !endTime) return false;
  return endTime < startTime;
}

// Dashboard tab split:
// - If endTime is set: in past once endTime has passed (on next day if endTime < startTime).
// - If endTime is missing: same as !isEventStillOnline (06:00 next-day cutoff).
export function isEventInPast(
  event: Pick<BarlinEvent, "date" | "startTime" | "endTime">,
  now: Date = new Date(),
): boolean {
  if (event.endTime) {
    const [y, mo, d] = event.date.split("-").map(Number);
    const [h, m] = event.endTime.split(":").map(Number);
    if (!y || !mo || !d || Number.isNaN(h) || Number.isNaN(m)) {
      return !isEventStillOnline(event, now);
    }
    const dayOffset = endsNextDay(event.startTime, event.endTime) ? 1 : 0;
    const end = new Date(y, mo - 1, d + dayOffset, h, m, 0, 0);
    return now.getTime() >= end.getTime();
  }
  return !isEventStillOnline(event, now);
}
