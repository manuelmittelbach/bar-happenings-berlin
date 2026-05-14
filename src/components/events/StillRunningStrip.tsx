import { Link } from "react-router-dom";
import { cleanEventTitle } from "@/lib/cleanTitle";
import EventMeta from "@/components/events/EventMeta";
import type { BarlinEvent } from "@/types/event";
import type { CategoryRow } from "@/lib/supabaseQueries";

interface StillRunningStripProps {
  events: BarlinEvent[];
  categories: CategoryRow[];
  onEventClick: (eventId: string) => void;
}

/* StillRunningStrip — yesterday's events that are still happening past
 * midnight. Same wide-card layout as FreeTonightStrip, but with a black
 * "Since yesterday" pill on the right (instead of the orange Free pill)
 * to signal that these slipped in from the prior calendar date.
 *
 * Renders nothing when there are no carry-over events, so the section
 * only appears in the small window between 00:00 and the cutoff of the
 * latest cross-midnight event (usually 02:00–05:00). */
export default function StillRunningStrip({
  events,
  categories,
  onEventClick,
}: StillRunningStripProps) {
  if (events.length === 0) return null;

  return (
    <section>
      {/* Container holds the sticky header + cards. pb (instead of pt)
          extends the sticky's containing block past the cards so the
          next section (Highlights / FreeTonight) butts directly against
          this section's bottom — the chain swap with the next sticky
          header happens at the same scroll instant the previous one
          gets pushed up. */}
      <div className="container py-6 md:py-8">
        <div
          className="sticky z-30 bg-background mb-3.5"
          style={{ top: "var(--chrome-bottom, 130px)" }}
        >
          <div className="border-b border-border pt-2.5 pb-2.5 flex items-baseline gap-3.5 flex-wrap -mx-6 px-6 md:mx-0 md:px-0">
            <h2 className="heading-display text-2xl md:text-[30px] leading-none m-0">
              Since yesterday
            </h2>
            <span className="flex-1" />
            {/* Counter — auf Mobile nur die Zahl, auf Desktop „N still on"
                (Platz da, also explizit). */}
            <span className="mono-label text-muted-foreground">
              <span className="md:hidden">{events.length}</span>
              <span className="hidden md:inline">
                {events.length} still on
              </span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3.5">
          {events.map((event) => (
            <StillRunningCard
              key={event.id}
              event={event}
              categories={categories}
              onClick={onEventClick}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

interface StillRunningCardProps {
  event: BarlinEvent;
  categories: CategoryRow[];
  onClick: (eventId: string) => void;
}

function StillRunningCard({ event, categories, onClick }: StillRunningCardProps) {
  const displayTitle = cleanEventTitle(event.title, event.venue);
  const isCanceled = event.status === "canceled";

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick(event.id);
  };

  return (
    <Link
      to={`/event/${event.id}`}
      onClick={handleClick}
      className={`group grid grid-cols-[1fr_auto] items-center gap-4 md:gap-5 px-4 md:px-5 py-4 md:py-[18px] bg-background border-2 border-foreground hover:border-accent transition-all no-underline text-foreground shadow-[0_18px_40px_-28px_hsla(18,85%,52%,0.3)] hover:shadow-[0_22px_50px_-28px_hsla(18,85%,52%,0.4)] ${
        isCanceled ? "opacity-50" : ""
      }`}
    >
      <div className="min-w-0">
        <EventMeta event={event} categories={categories} size="md" />
        <h3 className={`font-body text-[24px] font-bold leading-[1.2] mt-2 mb-0 ${isCanceled ? "line-through" : ""}`}>
          {displayTitle}
        </h3>
        <div className="font-body text-[13px] text-muted-foreground mt-1 truncate">
          {event.venue}
          {event.neighborhood ? ` · ${event.neighborhood}` : ""}
        </div>
      </div>
      {/* Inverted pill (black on cream) so it doesn't collide visually
          with the orange Free / Donation pill that may appear inside
          the EventMeta row on the left. */}
      <span className="self-start shrink-0 inline-flex items-center px-2.5 py-1 bg-foreground text-background font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
        Since yesterday
      </span>
    </Link>
  );
}
