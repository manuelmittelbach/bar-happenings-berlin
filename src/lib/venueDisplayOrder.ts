import type { Venue, BarlinEvent } from "@/types/event";
import { isEventStillOnline } from "@/lib/eventStatus";
import { neighborhoodRank } from "@/lib/neighborhoodFromAddress";

// Shared ordering for the Bars directory. BarsList renders these groups as
// hood sections; Layout flattens them to preload the first few cover images.
// Keeping the logic in one place means the preloaded covers always match the
// first cards the user actually sees when they open the tab.

export interface VenueHood {
  // Neighborhood name, or "Other" for venues with no recognized hood.
  name: string;
  // Venues in display order (see groupVenuesByHood for the within-hood rule).
  items: Venue[];
}

// Events happening tonight (event.date === today, not canceled, still online,
// has a venue) grouped by venueId, each list sorted by start time ascending so
// the earliest event surfaces first. Drives the per-card "tonight" signal line
// and the within-hood ordering below.
export function buildTonightEventsMap(
  events: BarlinEvent[],
  today: string,
): Map<string, BarlinEvent[]> {
  const map = new Map<string, BarlinEvent[]>();
  for (const e of events) {
    if (e.date !== today) continue;
    if (e.status === "canceled") continue;
    if (!isEventStillOnline(e)) continue;
    if (!e.venueId) continue;
    const list = map.get(e.venueId) || [];
    list.push(e);
    map.set(e.venueId, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) =>
      (a.startTime || "99:99").localeCompare(b.startTime || "99:99"),
    );
  }
  return map;
}

// Group venues into hood sections, ordered for display:
//   - Hoods follow the fixed NEIGHBORHOOD_DISPLAY_ORDER; unlisted hoods sort
//     after listed ones (alphabetical tiebreak); "Other" is pinned last.
//   - Within a hood: venues with events tonight come first, ordered by earliest
//     start time (unknown start times sink to the end of that group); the rest
//     follow alphabetically (case-insensitive).
// `tonightByVenue` is the map from buildTonightEventsMap (already start-sorted).
export function groupVenuesByHood(
  venues: Venue[],
  tonightByVenue: Map<string, BarlinEvent[]>,
): VenueHood[] {
  const groups = new Map<string, Venue[]>();
  for (const v of venues) {
    const h = (v.neighborhood || "").trim() || "Other";
    const list = groups.get(h) || [];
    list.push(v);
    groups.set(h, list);
  }

  // First event with a known start time. Lists are pre-sorted by start time,
  // so the first non-empty startTime is the earliest. null = no known time.
  const earliestStart = (id: string): string | null => {
    const list = tonightByVenue.get(id);
    if (!list || list.length === 0) return null;
    for (const e of list) {
      if (e.startTime) return e.startTime;
    }
    return null;
  };

  return [...groups.entries()]
    .map(([name, items]) => ({
      name,
      items: [...items].sort((a, b) => {
        const aHas = (tonightByVenue.get(a.id)?.length || 0) > 0;
        const bHas = (tonightByVenue.get(b.id)?.length || 0) > 0;
        if (aHas !== bHas) return aHas ? -1 : 1;
        if (aHas && bHas) {
          // Both have tonight events: earliest startTime first; unknown
          // start times sink to the bottom of this group.
          const aTime = earliestStart(a.id);
          const bTime = earliestStart(b.id);
          if (aTime !== null && bTime === null) return -1;
          if (aTime === null && bTime !== null) return 1;
          if (aTime !== null && bTime !== null && aTime !== bTime) {
            return aTime.localeCompare(bTime);
          }
          return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
        }
        // Neither has tonight events → alphabetical.
        return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
      }),
    }))
    .sort((a, b) => {
      if (a.name === "Other") return 1;
      if (b.name === "Other") return -1;
      const ra = neighborhoodRank(a.name);
      const rb = neighborhoodRank(b.name);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
}
