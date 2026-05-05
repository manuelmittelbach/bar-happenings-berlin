import { parseRule, describeRule } from "@/lib/recurrence";

/**
 * Generates contextual timing labels like "Happening tonight", "Tomorrow evening", "In 2 days"
 */
export function getTimingLabel(dateStr: string, startTime?: string): string | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [year, month, day] = dateStr.split("-").map(Number);
  const eventDate = new Date(year, month - 1, day);
  
  const diffDays = Math.round((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const timeOfDay = getTimeOfDay(startTime);

  if (diffDays < 0) return null; // past
  if (diffDays === 0) {
    if (timeOfDay) return `Happening ${timeOfDay}`;
    return "Happening today";
  }
  if (diffDays === 1) {
    if (timeOfDay) return `Tomorrow ${timeOfDay}`;
    return "Tomorrow";
  }
  if (diffDays === 2) return "In 2 days";
  if (diffDays === 3) return "In 3 days";
  if (diffDays <= 7) return "This week";
  
  return null;
}

function getTimeOfDay(startTime?: string): string | null {
  if (!startTime) return null;
  const upper = startTime.toUpperCase().trim();
  const cleaned = upper.replace(/\s*(AM|PM)\s*/i, "");
  const [h] = cleaned.split(":").map(Number);
  
  let hours = h;
  if (upper.includes("PM") && h !== 12) hours = h + 12;
  else if (upper.includes("AM") && h === 12) hours = 0;
  
  if (hours >= 17) return "tonight";
  if (hours >= 12) return "this afternoon";
  return "this morning";
}

/**
 * Returns social proof microcopy based on interest count
 */
export function getSocialProofText(count: number): { text: string; highlight: boolean } {
  if (count >= 35) return { text: `${count} people are going`, highlight: true };
  if (count >= 20) return { text: `${count} interested · Popular this week`, highlight: true };
  if (count >= 10) return { text: `${count} people interested`, highlight: false };
  if (count >= 5) return { text: `${count} interested`, highlight: false };
  return { text: `${count} interested`, highlight: false };
}

/**
 * Generates an editorial "moment" line based on category + venue context
 */
export function getMomentLine(
  category: string,
  venue: string,
  neighborhood: string,
  recurrence?: string,
  startDate?: string,
): string {
  const parsed = recurrence ? parseRule(recurrence) : null;
  const recurrenceText = parsed && startDate
    ? describeRule(startDate, parsed.freq)
    : (recurrence ?? "").toLowerCase();
  const dayPart = recurrenceText ? ` ${recurrenceText}` : "";
  
  // Keys are category slug-IDs (categories.id).
  const moments: Record<string, string[]> = {
    "comedy": [`Live laughs in ${neighborhood}`, `Comedy night vibes${dayPart}`],
    "pub-quiz": [`Test your brain in ${neighborhood}`, `A cozy quiz night in ${neighborhood}`],
    "language-exchange": [`Meet the world in ${neighborhood}`, `Languages & drinks${dayPart}`],
    "social": [`Connect with new people in ${neighborhood}`, `Social drinks & good energy`],
    "singles": [`Sparks fly in ${neighborhood}`, `Meet someone new${dayPart}`],
    "dj-music": [`Feel the beat in ${neighborhood}`, `Late-night energy${dayPart}`],
    "live-music": [`Live sounds in ${neighborhood}`, `Music & atmosphere${dayPart}`],
    "open-mic": [`Take the stage in ${neighborhood}`, `Open mic energy${dayPart}`],
  };

  const options = moments[category] || [`A night out in ${neighborhood}`];
  // Deterministic pick based on venue name
  const hash = venue.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return options[hash % options.length];
}
