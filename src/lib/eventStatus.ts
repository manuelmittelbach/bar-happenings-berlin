import type { BarlinEvent } from "@/types/event";

// Event "disappears from the main page" moment: 06:00 of the day AFTER event.date.
// Matches the existing Index.tsx / MapPage.tsx cutoff behavior.
export function isEventStillOnline(
  event: Pick<BarlinEvent, "date">,
  now: Date = new Date(),
): boolean {
  const [y, mo, d] = event.date.split("-").map(Number);
  if (!y || !mo || !d) return false;
  const cutoff = new Date(y, mo - 1, d + 1, 6, 0, 0, 0);
  return now.getTime() < cutoff.getTime();
}

// Dashboard tab split:
// - If endTime is set: in past once endTime has passed on event.date.
// - If endTime is missing: same as !isEventStillOnline (06:00 next-day cutoff).
export function isEventInPast(
  event: Pick<BarlinEvent, "date" | "endTime">,
  now: Date = new Date(),
): boolean {
  if (event.endTime) {
    const [y, mo, d] = event.date.split("-").map(Number);
    const [h, m] = event.endTime.split(":").map(Number);
    if (!y || !mo || !d || Number.isNaN(h) || Number.isNaN(m)) {
      return !isEventStillOnline(event, now);
    }
    const end = new Date(y, mo - 1, d, h, m, 0, 0);
    return now.getTime() >= end.getTime();
  }
  return !isEventStillOnline(event, now);
}
