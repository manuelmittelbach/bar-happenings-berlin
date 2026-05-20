import EventCard from "@/components/events/EventCard";
import type { BarlinEvent } from "@/types/event";
import type { CategoryRow } from "@/lib/supabaseQueries";

interface StillRunningStripProps {
  events: BarlinEvent[];
  // Kept in the prop signature so callers stay unchanged, but unused —
  // EventCard fetches its own categories via useCategories.
  categories?: CategoryRow[];
  onEventClick: (eventId: string) => void;
}

/* StillRunningStrip — yesterday's events that are still happening past
 * midnight. Same responsive card grid as FreeTonightStrip (1 col mobile,
 * 2/3/4 columns from md upward), using EventCard's "grid" layout for
 * the editorial highlight chrome. */
export default function StillRunningStrip({
  events,
  onEventClick,
}: StillRunningStripProps) {
  if (events.length === 0) return null;

  return (
    <section>
      <div className="container py-6 md:py-8">
        {/* Section header is sticky on mobile so the heading pins below the
            day+category chrome. Top-padding lives on the container (not the
            sticky wrapper) so when pinned, the heading sits tight under the
            chrome — only the inner pt-2.5 gives breathing room. Static on
            desktop where the wider layout makes multiple stickies feel
            busier than helpful. */}
        <div
          className="mb-2.5 sticky bg-background z-30"
          style={{ top: 0 }}
        >
          <div className="pt-2.5 pb-2.5 flex items-baseline gap-3.5 flex-wrap border-b-2 border-border">
            <h2 className="heading-display text-2xl md:text-[30px] leading-none m-0">
              Since yesterday
            </h2>
            <span className="flex-1" />
            <span className="mono-label text-muted-foreground">
              <span className="md:hidden">{events.length}</span>
              <span className="hidden md:inline">
                {events.length} still on
              </span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              layout="grid"
              onClick={onEventClick}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
