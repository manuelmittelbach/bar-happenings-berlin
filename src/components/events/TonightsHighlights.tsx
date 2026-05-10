import { useMemo } from "react";
import { Star } from "lucide-react";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { getEventBadge, type EventBadge } from "@/lib/eventBadges";
import { useUserLocation } from "@/hooks/useUserLocation";
import { useVenues } from "@/hooks/useEvents";
import { haversineMeters, walkingMinutes } from "@/lib/distance";
import type { BarlinEvent } from "@/types/event";
import type { CategoryRow } from "@/lib/supabaseQueries";

interface TonightsHighlightsProps {
  // Already filtered to is_highlight === true and a single target date
  // (typically today). Caller decides which date "tonight" maps to so the
  // component stays presentational.
  events: BarlinEvent[];
  categories: CategoryRow[];
  onEventClick: (eventId: string) => void;
  // Maximum number of cards to render. Default 4 (the 2x2 magazine grid).
  // Lower values still render a clean grid (3 → 1+2, 2 → side-by-side, 1 → single).
  limit?: number;
}

const badgeChipClasses: Record<EventBadge["variant"], string> = {
  soon: "bg-muted text-foreground border border-border",
  popular: "border border-accent/40 text-accent bg-accent/10",
};

/* Highlights — the magazine-style "above the fold" of the homepage.
 *
 * Renders a 2x2 grid of editor-curated events for tonight. All four cards
 * are visually equal (no internal hierarchy) so the user reads them as a
 * curated set, not a ranked list. Sorting (highlight_priority) only affects
 * which 4 events appear when there are more than 4 candidates.
 *
 * Renders nothing when no events match — the homepage skips the section
 * entirely on those days, which is fine: a placeholder would feel sad.
 */
export default function TonightsHighlights({
  events,
  categories,
  onEventClick,
  limit = 4,
}: TonightsHighlightsProps) {
  const { location: userLocation } = useUserLocation();
  const { data: venues = [] } = useVenues();

  // Sort by curator priority, then start_time so two events with the same
  // priority show in chronological order (matches how a magazine editor
  // would lay them out — "earliest of the picked four first").
  const sorted = useMemo(() => {
    return [...events]
      .sort((a, b) => {
        const p = a.highlightPriority - b.highlightPriority;
        if (p !== 0) return p;
        const tA = a.startTime || "99:99";
        const tB = b.startTime || "99:99";
        return tA.localeCompare(tB);
      })
      .slice(0, limit);
  }, [events, limit]);

  if (sorted.length === 0) return null;

  return (
    <section className="border-t-2 border-foreground bg-background">
      <div className="container py-10 md:py-14">
        {/* Magazine-style section header */}
        <div className="flex items-baseline justify-between gap-4 mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <Star className="h-5 w-5 text-accent shrink-0" strokeWidth={2.5} />
            <h2 className="font-heading text-2xl md:text-3xl font-extrabold uppercase tracking-tight">
              Tonight's Highlights
            </h2>
          </div>
          <span className="mono-label text-muted-foreground hidden sm:inline">
            Editor's picks
          </span>
        </div>

        {/* 2×2 grid: 1 col mobile, 2 cols on md+ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {sorted.map((event) => (
            <HighlightCard
              key={event.id}
              event={event}
              categories={categories}
              userLocation={userLocation}
              venues={venues}
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
  userLocation: { lat: number; lng: number } | null;
  venues: { id: string; lat: number; lng: number }[];
  onClick: (eventId: string) => void;
}

function HighlightCard({
  event,
  categories,
  userLocation,
  venues,
  onClick,
}: HighlightCardProps) {
  const displayTitle = cleanEventTitle(event.title, event.venue);
  const categoryInfo = categories.find((c) => c.id === event.category);
  const categoryColor = categoryInfo?.color;
  const categoryLabel = categoryInfo?.label ?? event.category;
  const isCanceled = event.status === "canceled";
  const badge = getEventBadge(event, event.interestedCount ?? 0);
  const isPastEvent = badge?.label === "Might be over" || badge?.label === "Over";

  const walkingMins = (() => {
    if (!userLocation) return null;
    const v = venues.find((x) => x.id === event.venueId);
    if (!v?.lat || !v?.lng) return null;
    const m = haversineMeters(userLocation.lat, userLocation.lng, v.lat, v.lng);
    return walkingMinutes(m);
  })();

  return (
    <button
      onClick={() => onClick(event.id)}
      className={`group relative flex flex-col text-left bg-background border-2 border-foreground hover:border-accent transition-all overflow-hidden card-hover-lift ${
        isCanceled || isPastEvent ? "opacity-60" : ""
      }`}
    >
      {/* Top accent bar — visual signature of the highlights treatment */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-accent" />

      <div className="p-5 md:p-6 flex-1 flex flex-col">
        {/* Meta row: time + category */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {event.startTime && (
            <>
              <span className="font-mono font-bold text-xs uppercase tracking-wider">
                {event.startTime}
              </span>
              <span className="text-muted-foreground text-xs">·</span>
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
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-body font-extrabold uppercase tracking-wide ${badgeChipClasses[badge.variant]}`}
            >
              <badge.icon className="h-2.5 w-2.5" />
              {badge.label}
            </span>
          )}
        </div>

        {/* Title — magazine-prominent */}
        <h3 className="font-body text-2xl md:text-3xl font-bold leading-tight group-hover:text-accent transition-colors line-clamp-2 mb-2">
          {displayTitle}
        </h3>

        {/* Venue + walking distance */}
        <div className="flex items-center gap-1.5 mb-3 text-sm text-muted-foreground font-medium min-w-0">
          <span className="truncate">{event.venue}</span>
          {walkingMins !== null && walkingMins <= 20 ? (
            <>
              <span className="opacity-60 shrink-0">·</span>
              <span className="shrink-0">{walkingMins} min walk</span>
            </>
          ) : event.neighborhood ? (
            <>
              <span className="opacity-60 shrink-0">·</span>
              <span className="truncate">{event.neighborhood}</span>
            </>
          ) : null}
        </div>

        {/* Editor blurb — italic, magazine-style. Falls back to description
            so the card still has body copy for events without an editor note. */}
        {event.editorNote ? (
          <p className="font-body italic text-[15px] leading-relaxed text-foreground line-clamp-3 border-l-2 border-accent pl-3 mt-auto">
            {event.editorNote}
          </p>
        ) : event.description ? (
          <p className="text-sm text-muted-foreground line-clamp-3 mt-auto">
            {event.description}
          </p>
        ) : null}
      </div>
    </button>
  );
}
