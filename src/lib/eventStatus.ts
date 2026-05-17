import type { BarlinEvent } from "@/types/event";

// Event "disappears from the main page" moment.
// - endTime present → cutoff is the endTime itself (rolls to the next day
//   when endTime < startTime, e.g. 22:00–02:00).
// - endTime missing → cutoff is startTime + 90min (matches the "Now"
//   indicator window in isLiveNow so a card never lingers past Now).
// - Neither time parseable (unknown start time) → cutoff is 22:00 on
//   event.date. Without a known start we can't tell whether the night
//   is just starting or already over, so we fall off at the
//   conventional "late evening" mark instead of lingering until
//   midnight — a card with no time still showing at 23:30 reads as
//   "stale data," not "happening right now."
export function isEventStillOnline(
  event: Pick<BarlinEvent, "date" | "startTime" | "endTime">,
  now: Date = new Date(),
): boolean {
  const [y, mo, d] = event.date.split("-").map(Number);
  if (!y || !mo || !d) return false;

  if (event.endTime) {
    const [h, m] = event.endTime.split(":").map(Number);
    if (!Number.isNaN(h) && !Number.isNaN(m)) {
      const dayOffset = endsNextDay(event.startTime, event.endTime) ? 1 : 0;
      const cutoff = new Date(y, mo - 1, d + dayOffset, h, m, 0, 0);
      return now.getTime() < cutoff.getTime();
    }
  }

  if (event.startTime) {
    const [h, m] = event.startTime.split(":").map(Number);
    if (!Number.isNaN(h) && !Number.isNaN(m)) {
      const start = new Date(y, mo - 1, d, h, m, 0, 0);
      const cutoff = new Date(start.getTime() + 90 * 60 * 1000);
      return now.getTime() < cutoff.getTime();
    }
  }

  const cutoff = new Date(y, mo - 1, d, 22, 0, 0, 0);
  return now.getTime() < cutoff.getTime();
}

// Currently live: now is between startTime and endTime (or startTime+90min
// when no endTime). Returns false for non-today events. Used to swap the
// time label for a pulsing "Now" indicator on event cards.
export function isLiveNow(
  event: Pick<BarlinEvent, "date" | "startTime" | "endTime">,
  now: Date = new Date(),
): boolean {
  const [y, mo, d] = event.date.split("-").map(Number);
  if (!y || !mo || !d || !event.startTime) return false;
  const [sh, sm] = event.startTime.split(":").map(Number);
  if (Number.isNaN(sh) || Number.isNaN(sm)) return false;
  const start = new Date(y, mo - 1, d, sh, sm, 0, 0);
  let end: Date;
  if (event.endTime) {
    const [eh, em] = event.endTime.split(":").map(Number);
    if (Number.isNaN(eh) || Number.isNaN(em)) {
      end = new Date(start.getTime() + 90 * 60 * 1000);
    } else {
      const dayOffset = endsNextDay(event.startTime, event.endTime) ? 1 : 0;
      end = new Date(y, mo - 1, d + dayOffset, eh, em, 0, 0);
    }
  } else {
    end = new Date(start.getTime() + 90 * 60 * 1000);
  }
  return now >= start && now < end;
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
// - If endTime is missing: same as !isEventStillOnline (startTime + 90min cutoff).
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
