import { useMemo } from "react";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { getEventBadge, type EventBadge } from "@/lib/eventBadges";
import { isFreeEntry, isPayWhatYouWantEntry } from "@/lib/entryInfo";
import type { BarlinEvent } from "@/types/event";
import type { CategoryRow } from "@/lib/supabaseQueries";

// Same chip styles as the rest of the editorial sections — keeps badge
// rendering visually identical between Close Tonight and Free Tonight.
const badgeChipClasses: Record<EventBadge["variant"], string> = {
  soon: "bg-muted text-foreground border border-border",
  popular: "border border-accent/40 text-accent bg-accent/10",
};

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
          <h2 className="font-heading text-2xl md:text-3xl font-extrabold uppercase tracking-tight">
            Free Tonight
          </h2>
          <span className="mono-label text-muted-foreground hidden sm:inline ml-2">
            Free entry &amp; pay what you want
          </span>
        </div>

        {/* 2-Spalten-Grid wie in Close Tonight — gleiche Kartendimensionen,
            visuell konsistent zwischen den beiden editorialen Sektionen. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
  const categoryInfo = categories.find((c) => c.id === event.category);
  const categoryColor = categoryInfo?.color;
  const categoryLabel = categoryInfo?.label ?? event.category;
  const isFree = isFreeEntry(event.entryInfo);
  const isCanceled = event.status === "canceled";
  const badge = getEventBadge(event);
  const isPastEvent = badge?.label === "Might be over" || badge?.label === "Over";

  const tagLabel = isFree ? "Free" : "Pay what you want";

  return (
    <button
      onClick={() => onClick(event.id)}
      className={`group flex flex-col text-left bg-background border-2 border-border hover:border-foreground transition-colors overflow-hidden ${
        isCanceled || isPastEvent ? "opacity-60" : ""
      }`}
    >
      <div className="py-2.5 px-3 md:px-4 flex-1 flex flex-col">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          {event.startTime && (
            <>
              <span className="font-mono font-bold text-[10px] md:text-xs uppercase tracking-wider">
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
          {badge && (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-body font-extrabold uppercase tracking-wide ${badgeChipClasses[badge.variant]}`}
            >
              <badge.icon className="h-2.5 w-2.5" />
              {badge.label}
            </span>
          )}
          {/* FREE / PAY WHAT YOU WANT — kleines schwarzes Kästchen rechts
              (ml-auto schiebt es ans Ende der Flex-Row). */}
          <span className="ml-auto inline-flex items-center px-1.5 py-0.5 bg-foreground text-background text-[9px] font-mono font-extrabold uppercase tracking-wider">
            {tagLabel}
          </span>
        </div>

        <h3 className="font-body text-base md:text-lg font-bold leading-snug group-hover:text-accent transition-colors line-clamp-1">
          {displayTitle}
        </h3>

        <p className="text-xs text-muted-foreground truncate">
          {event.venue}
          {event.neighborhood ? ` · ${event.neighborhood}` : ""}
        </p>
      </div>
    </button>
  );
}
