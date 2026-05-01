import { Clock, TrendingUp, type LucideIcon } from "lucide-react";
import type { BarlinEvent } from "@/types/event";

export interface EventBadge {
  label: string;
  variant: "soon" | "popular";
  icon: LucideIcon;
}

function parseEventDateTime(dateStr: string, timeStr: string): Date {
  // dateStr: "YYYY-MM-DD", timeStr: "HH:MM" or "HH:MM AM/PM"
  const [year, month, day] = dateStr.split("-").map(Number);
  
  let hours: number;
  let minutes: number;
  
  const upper = timeStr.toUpperCase().trim();
  const isPM = upper.includes("PM");
  const isAM = upper.includes("AM");
  const cleaned = upper.replace(/\s*(AM|PM)\s*/i, "");
  const [h, m] = cleaned.split(":").map(Number);
  
  if (isPM && h !== 12) hours = h + 12;
  else if (isAM && h === 12) hours = 0;
  else hours = h;
  minutes = m || 0;

  return new Date(year, month - 1, day, hours, minutes);
}

export function getEventBadge(
  event: BarlinEvent,
  interestedCount: number
): EventBadge | null {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const isLateNight = now.getHours() < 6;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const cutoff = isLateNight ? yesterday : todayStr;
  if (event.date < cutoff) return null;

  const hasTime = Boolean(event.startTime && event.startTime.trim());

  // Temporal badges require a specified start time
  if (hasTime) {
    const start = parseEventDateTime(event.date, event.startTime);
    const hasEndTime = Boolean(event.endTime && event.endTime.trim());

    if (hasEndTime) {
      // Known end time
      const end = parseEventDateTime(event.date, event.endTime);
      if (end <= start) end.setDate(end.getDate() + 1);

      if (now > end) {
        return { label: "Over", variant: "soon", icon: Clock };
      }
      if (now >= start) {
        return { label: "Happening Now", variant: "soon", icon: Clock };
      }
    } else {
      // No end time — "Happening Now" for 1.5h, then "Might be over"
      const mightBeOver = new Date(start.getTime() + 1.5 * 60 * 60 * 1000);
      const nextDay6am = new Date(start);
      nextDay6am.setDate(nextDay6am.getDate() + 1);
      nextDay6am.setHours(6, 0, 0, 0);
      if (now >= mightBeOver && now < nextDay6am) {
        return { label: "Might be over", variant: "soon", icon: Clock };
      }
      if (now >= start) {
        return { label: "Happening Now", variant: "soon", icon: Clock };
      }
    }

    // Starting Soon — within 2 hours
    const diffMs = start.getTime() - now.getTime();
    if (diffMs > 0 && diffMs <= 2 * 60 * 60 * 1000) {
      const label = diffMs <= 60 * 60 * 1000 ? "Starts in <1h" : "Starts in <2h";
      return { label, variant: "soon", icon: Clock };
    }
  }

  return null;
}
