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
      <div className="container py-6 md:py-8">
        <div className="flex items-baseline justify-between gap-4 flex-wrap border-b-2 border-foreground pb-3.5 mt-6 mb-5">
          <h2 className="heading-display text-2xl md:text-[30px] leading-none m-0">
            Since yesterday
          </h2>
          {/* Counter Desktop-only — see FreeTonightStrip for rationale. */}
          <div className="hidden md:block mono-label text-muted-foreground">
            {events.length} still on
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
      className={`group grid grid-cols-[1fr_auto] items-center gap-4 md:gap-5 px-4 md:px-5 py-4 md:py-[18px] bg-background border-2 border-foreground hover:border-accent transition-colors no-underline text-foreground ${
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
