import EventCard from "@/components/events/EventCard";
import type { BarlinEvent } from "@/types/event";

interface NearbyStripProps {
  // Pre-computed nearest-first list of {event, walking minutes}. Computed
  // in Index.tsx (not here) so the same list can drive "More tonight"
  // dedupe — keeping it pure-input means no walking math is duplicated.
  nearby: { event: BarlinEvent; min: number }[];
  onEventClick: (eventId: string) => void;
  // Default "Nearby tonight"; Tomorrow tab passes "Nearby tomorrow".
  title?: string;
  // Surfaced in the desktop counter copy ("N within 15 min"). Mirrored
  // from the value Index passed to computeNearbyEvents so the chrome
  // and the cutoff don't drift out of sync.
  maxWalkingMin?: number;
}

/* NearbyStrip — events at walkable distance from the user's location.
 * Mirrors FreeTonightStrip / StillRunningStrip structurally (sticky header
 * on mobile, gray rule, EventCard list rows). Each card surfaces a walking
 * minutes chip via EventCard.walkingMin. Caller is responsible for only
 * rendering this strip when location is actually available and the list
 * isn't empty.
 */
export default function NearbyStrip({
  nearby,
  onEventClick,
  title = "Nearby tonight",
  maxWalkingMin = 15,
}: NearbyStripProps) {
  if (nearby.length === 0) return null;

  return (
    <section>
      <div className="container py-6 md:py-8">
        {/* Sticky on mobile, static on desktop — same chrome as the other
            section headers (FreeTonightStrip, StillRunningStrip, DayList). */}
        <div
          className="mb-2.5 sticky md:static bg-background z-30"
          style={{ top: "calc(var(--chrome-bottom, 130px) - 2px)" }}
        >
          <div className="pt-2.5 pb-2.5 flex items-baseline gap-3.5 flex-wrap border-b-2 border-border">
            <h2 className="heading-display text-2xl md:text-[30px] leading-none m-0">
              {title}
            </h2>
            <span className="flex-1" />
            <span className="mono-label text-muted-foreground">
              <span className="md:hidden">{nearby.length}</span>
              <span className="hidden md:inline">
                {nearby.length} within {maxWalkingMin} min
              </span>
            </span>
          </div>
        </div>

        {/* Flat list rows on every breakpoint — Nearby is sorted by distance
            (an ordinal property), so a grid would scramble the "closest →
            farthest" reading order on desktop. */}
        <div>
          {nearby.map(({ event, min }) => (
            <EventCard
              key={event.id}
              event={event}
              layout="list"
              onClick={onEventClick}
              walkingMin={min}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
