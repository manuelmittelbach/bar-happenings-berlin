import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { isFreeEntry, isPayWhatYouWantEntry } from "@/lib/entryInfo";
import type { BarlinEvent } from "@/types/event";
import type { CategoryRow } from "@/lib/supabaseQueries";

interface FreeTonightStripProps {
  // Already filtered to the target date (typically today). The strip
  // applies its own filter for free / pay-what-you-want events and decides
  // ordering. Keeps Index.tsx flat — it just hands over the day's events.
  events: BarlinEvent[];
  categories: CategoryRow[];
  onEventClick: (eventId: string) => void;
  // Cap the number of cards so the strip stays scannable. Default 10 keeps
  // ~3 cards visible at desktop width with one peek.
  limit?: number;
}

/* FreeTonight — kompakte horizontale Reihe von Free / Pay-what-you-want Events.
 *
 * Why a horizontal strip and not another grid: the highlights and full Today
 * list already use grid/list layouts. A horizontal scroller breaks the
 * vertical rhythm and signals "scan this set, then move on." It's the
 * editorial equivalent of a sidebar feature in print magazines.
 *
 * Renders nothing when no free events exist for the day — the section
 * disappears rather than show "0 events" copy.
 */
export default function FreeTonightStrip({
  events,
  categories,
  onEventClick,
  limit = 10,
}: FreeTonightStripProps) {
  const freeEvents = useMemo(() => {
    return events
      .filter((e) => {
        if (e.status === "canceled") return false;
        return isFreeEntry(e.entryInfo) || isPayWhatYouWantEntry(e.entryInfo);
      })
      .sort((a, b) => {
        // Free events first within the strip (cleaner "hard zero cost"
        // ranking before donation-optional ones), then chronological.
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
    <section className="border-t border-border bg-muted/20">
      <div className="container py-10 md:py-12">
        <div className="flex items-center gap-3 mb-5">
          <Sparkles className="h-5 w-5 text-accent shrink-0" strokeWidth={2.5} />
          <h2 className="font-heading text-2xl md:text-3xl font-extrabold uppercase tracking-tight">
            Free Tonight
          </h2>
          <span className="mono-label text-muted-foreground hidden sm:inline ml-2">
            Free entry &amp; pay what you want
          </span>
        </div>

        {/* Horizontal scroller. snap-x keeps each card aligning to the left
            edge after a flick. -mx + px on the scroll container gives the
            cards full-bleed runway on small screens without breaking the
            container alignment. */}
        <div className="relative -mx-4 md:mx-0">
          <div
            className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory px-4 md:px-0 pb-2"
            // Hide native scrollbar visually — the horizontal-scroll
            // affordance comes from the peek of the next card.
            style={{ scrollbarWidth: "none" }}
          >
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
  const categoryInfo = categories.find((c) => c.id === event.category);
  const categoryColor = categoryInfo?.color;
  const categoryLabel = categoryInfo?.label ?? event.category;
  const isFree = isFreeEntry(event.entryInfo);
  const tagLabel = isFree ? "Free" : "Pay what you want";

  return (
    <button
      onClick={() => onClick(event.id)}
      className="group shrink-0 snap-start w-[260px] md:w-[280px] flex flex-col text-left bg-background border-2 border-foreground hover:border-accent transition-colors overflow-hidden"
    >
      {/* Top strap: FREE/PWYW badge */}
      <div className={`px-3 py-1.5 ${isFree ? "bg-accent text-accent-foreground" : "bg-foreground text-background"}`}>
        <span className="font-mono font-extrabold text-[10px] uppercase tracking-wider">
          {tagLabel}
        </span>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          {event.startTime && (
            <>
              <span className="font-mono font-bold text-[10px] uppercase tracking-wider">
                {event.startTime}
              </span>
              <span className="text-muted-foreground text-[10px]">·</span>
            </>
          )}
          <span
            className="mono-label font-bold"
            style={categoryColor ? { color: categoryColor } : undefined}
          >
            {categoryLabel}
          </span>
        </div>

        <h3 className="font-body text-base font-bold leading-snug group-hover:text-accent transition-colors line-clamp-2">
          {displayTitle}
        </h3>

        <p className="text-xs text-muted-foreground truncate mt-auto">
          {event.venue}
          {event.neighborhood ? ` · ${event.neighborhood}` : ""}
        </p>
      </div>
    </button>
  );
}
