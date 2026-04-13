import { Clock, TrendingUp, type LucideIcon } from "lucide-react";
import type { BarlinEvent } from "@/data/mockData";

export interface EventBadge {
  label: string;
  variant: "live" | "soon" | "popular";
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
  const hasTime = Boolean(event.startTime && event.startTime.trim());

  // Temporal badges require a specified start time
  if (hasTime) {
    // 1. Happening Now — event started but not ended
    const start = parseEventDateTime(event.date, event.startTime);
    const end = event.endTime
      ? parseEventDateTime(event.date, event.endTime)
      : new Date(start.getTime() + 3 * 60 * 60 * 1000); // default 3h duration
  
    // Handle end times past midnight
    if (end <= start) end.setDate(end.getDate() + 1);
  
    if (now >= start && now <= end) {
      return { label: "Happening Now", variant: "soon", icon: Clock };
    }
  
    // 2. Starting Soon — today, within 2 hours
    const diffMs = start.getTime() - now.getTime();
    if (diffMs > 0 && diffMs <= 2 * 60 * 60 * 1000) {
      const label = diffMs <= 60 * 60 * 1000 ? "Starts in <1h" : "Starts in <2h";
      return { label, variant: "soon", icon: Clock };
    }
  }

  // DISABLED — re-enable to show popular badge
  // if (interestedCount > 30 && !event.featured) {
  //   return { label: "Popular", variant: "popular", icon: TrendingUp };
  // }

  return null;
}
