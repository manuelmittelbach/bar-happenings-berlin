import { useMemo } from "react";
import { Link } from "react-router-dom";
import { cleanEventTitle } from "@/lib/cleanTitle";
import EventMeta from "@/components/events/EventMeta";
import { isFreeEntry, isPayWhatYouWantEntry } from "@/lib/entryInfo";
import type { BarlinEvent } from "@/types/event";
import type { CategoryRow } from "@/lib/supabaseQueries";

interface FreeTonightStripProps {
  events: BarlinEvent[];
  categories: CategoryRow[];
  onEventClick: (eventId: string) => void;
  limit?: number;
  // Override the section title — defaults to "Free tonight" but the
  // Tomorrow tab reuses this component with "Free tomorrow".
  title?: string;
}

/* FreeTonight — wide cards with FREE / DONATION pill on the right.
 * Matches `EventCard.jsx` layout="free" from the design: 2px black border,
 * 24px body-bold title, mono meta (Now indicator + category + Free pill),
 * orange/cream pill at the right edge for the price tag.
 */
export default function FreeTonightStrip({
  events,
  categories,
  onEventClick,
  limit = 10,
  title = "Free tonight",
}: FreeTonightStripProps) {
  const freeEvents = useMemo(() => {
    return events
      .filter((e) => {
        if (e.status === "canceled") return false;
        return isFreeEntry(e.entryInfo) || isPayWhatYouWantEntry(e.entryInfo);
      })
      .sort((a, b) => {
        const aFree = isFreeEntry(a.entryInfo) ? 0 : 1;
        const bFree = isFreeEntry(b.entryInfo) ? 0 : 1;
        if (aFree !== bFree) return aFree - bFree;
        const tA = a.startTime || "99:99";
        const tB = b.startTime || "99:99";
        return tA.localeCompare(tB);
      })
      .slice(0, limit);
  }, [events, limit]);

  if (freeEvents.length === 0) return null;

  return (
    <section>
      <div className="container py-6 md:py-8">
        <div className="flex items-baseline justify-between gap-4 flex-wrap border-b-2 border-foreground pb-3.5 mt-10 mb-5">
          <h2 className="heading-display text-3xl md:text-[38px] leading-none m-0">
            {title}
          </h2>
          <div className="mono-label text-muted-foreground">
            {freeEvents.length} Free {freeEvents.length === 1 ? "event" : "events"}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3.5">
          {freeEvents.map((event) => (
            <FreeCard
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

interface FreeCardProps {
  event: BarlinEvent;
  categories: CategoryRow[];
  onClick: (eventId: string) => void;
}

function FreeCard({ event, categories, onClick }: FreeCardProps) {
  const displayTitle = cleanEventTitle(event.title, event.venue);
  const isFree = isFreeEntry(event.entryInfo);
  const isCanceled = event.status === "canceled";
  const tagLabel = isFree ? "Free" : "Donation";

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
        <FreeMeta event={event} categories={categories} />
        <h3 className={`font-body text-[24px] font-bold leading-[1.2] mt-2 mb-0 ${isCanceled ? "line-through" : ""}`}>
          {displayTitle}
        </h3>
        <div className="font-body text-[13px] text-muted-foreground mt-1 truncate">
          {event.venue}
          {event.neighborhood ? ` · ${event.neighborhood}` : ""}
        </div>
      </div>
      <span className="self-start shrink-0 inline-flex items-center px-2.5 py-1 bg-accent text-accent-foreground font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
        {tagLabel}
      </span>
    </Link>
  );
}

/* Free-card meta omits the inline Free/Donation pill because the wide card
 * already shows it on the right side. Time + category only. */
function FreeMeta({ event, categories }: { event: BarlinEvent; categories: CategoryRow[] }) {
  // EventMeta keeps the meta consistent; we wrap it but pass a clone of the
  // event with entryInfo blanked so the inline Free pill doesn't render.
  const clone = { ...event, entryInfo: "" } as BarlinEvent;
  return <EventMeta event={clone} categories={categories} size="md" />;
}
