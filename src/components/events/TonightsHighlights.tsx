import { useMemo } from "react";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { compareByStartTime } from "@/lib/eventListing";
import EventMeta from "@/components/events/EventMeta";
import type { BarlinEvent } from "@/types/event";
import type { CategoryRow } from "@/lib/supabaseQueries";
import { prefetchImage } from "@/hooks/usePrefetchImages";

interface TonightsHighlightsProps {
  events: BarlinEvent[];
  categories: CategoryRow[];
  onEventClick: (eventId: string) => void;
  limit?: number;
}

/* TonightsHighlights — magazine 2x2 grid of editor-picked events.
 * SectionHeader (eyebrow + display title + count) over a 2px black rule,
 * then four cards: 2px black border, 6px accent stripe across the top,
 * 20/18/18 padding, 20px body-bold title, 13px italic editor blurb with
 * a 2px accent left rule. */
export default function TonightsHighlights({
  events,
  categories,
  onEventClick,
  limit = 4,
}: TonightsHighlightsProps) {
  const sorted = useMemo(() => {
    return [...events]
      .sort((a, b) => {
        const p = a.highlightPriority - b.highlightPriority;
        if (p !== 0) return p;
        return compareByStartTime(a, b);
      })
      .slice(0, limit);
  }, [events, limit]);

  if (sorted.length === 0) return null;

  return (
    <section>
      <div className="container py-6 md:py-8">
        <div className="mb-2.5">
          <div className="mono-label text-accent mb-1.5">
            {sorted.length === 1 ? "Editor's pick" : "Editor's picks"}
          </div>
          {/* Counter sits on the same row as the h2 (not the eyebrow above)
              so its baseline lines up with "Highlights tonight" instead of
              "Editor's picks". */}
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <h2 className="heading-display text-2xl md:text-[30px] leading-none m-0">
              {sorted.length === 1 ? "Highlight event" : "Highlights events"}
            </h2>
            <div className="mono-label text-muted-foreground">
              <span className="md:hidden">{sorted.length}</span>
              <span className="hidden md:inline">{sorted.length} curated</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-[18px]">
          {sorted.map((event) => (
            <HighlightCard
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

interface HighlightCardProps {
  event: BarlinEvent;
  categories: CategoryRow[];
  onClick: (eventId: string) => void;
}

function HighlightCard({ event, categories, onClick }: HighlightCardProps) {
  const displayTitle = cleanEventTitle(event.title, event.venue);
  const isCanceled = event.status === "canceled";

  return (
    <button
      data-event-id={event.id}
      onClick={() => onClick(event.id)}
      onPointerEnter={() => prefetchImage(event.image)}
      onPointerDown={() => prefetchImage(event.image)}
      className={`group relative flex flex-col text-left bg-background border-2 border-foreground hover:border-accent active:border-accent transition-all overflow-hidden shadow-[0_18px_40px_-28px_hsla(18,85%,52%,0.3)] hover:shadow-[0_22px_50px_-28px_hsla(18,85%,52%,0.4)] ${
        isCanceled ? "opacity-55" : ""
      }`}
      style={{ padding: "20px 18px 18px" }}
    >
      <span className="absolute top-0 left-0 right-0 h-1.5 bg-accent" />

      <EventMeta event={event} categories={categories} />

      <h3 className={`font-body text-[20px] font-bold leading-[1.22] mt-2.5 mb-0 ${isCanceled ? "line-through" : ""}`}>
        {displayTitle}
      </h3>

      <div className="font-body text-[13px] text-muted-foreground mt-1 flex gap-1.5 items-center flex-wrap min-w-0">
        <span className="truncate">{event.venue}</span>
        {event.neighborhood && (
          <>
            <span className="opacity-50 shrink-0">·</span>
            <span className="truncate">{event.neighborhood}</span>
          </>
        )}
      </div>

      {event.editorNote && (
        <p className="font-body italic text-[13px] leading-[1.5] mt-3 mb-0 pl-3 border-l-2 border-accent text-foreground line-clamp-3">
          “{event.editorNote}”
        </p>
      )}
    </button>
  );
}
