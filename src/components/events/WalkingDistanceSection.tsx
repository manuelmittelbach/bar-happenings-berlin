import { useMemo } from "react";
import { Link } from "react-router-dom";
// Lucide's `Map` icon is aliased to MapIcon — importing it as `Map` would
// shadow the global Map constructor and break `new Map(...)` further down.
import { ArrowRight, Loader2, Map as MapIcon } from "lucide-react";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { getEventBadge, type EventBadge } from "@/lib/eventBadges";
import { useUserLocation } from "@/hooks/useUserLocation";
import { useVenues } from "@/hooks/useEvents";
import { haversineMeters, walkingMinutes } from "@/lib/distance";
import type { BarlinEvent } from "@/types/event";
import type { CategoryRow } from "@/lib/supabaseQueries";

interface WalkingDistanceSectionProps {
  // Caller passes events for the relevant date window (typically today +
  // tomorrow). The section internally filters by walking distance once
  // location is available.
  events: BarlinEvent[];
  categories: CategoryRow[];
  onEventClick: (eventId: string) => void;
  // Maximum walking minutes to include. Default 20 ≈ 1.6km — short enough
  // that the user reads it as "I could be there in a song or two" rather
  // than a planned trip.
  maxWalkingMinutes?: number;
  // How many cards to render at most. Keeps the section tight even in dense
  // neighborhoods.
  limit?: number;
}

const badgeChipClasses: Record<EventBadge["variant"], string> = {
  soon: "bg-muted text-foreground border border-border",
  popular: "border border-accent/40 text-accent bg-accent/10",
};

/* WalkingDistanceSection — replaces the old "Click here to show nearby events
 * first" banner. Three rendered states:
 *   idle    → empty state with explicit CTA. The section *itself* is the
 *             permission ask, so the user sees the reward (events I could
 *             walk to right now) before granting permission.
 *   loading → small spinner while geolocation resolves
 *   granted → list of nearest walkable events tonight
 *   denied  → renders nothing. The section vanishes silently rather than
 *             nag the user with an error state they can't resolve in-page.
 */
export default function WalkingDistanceSection({
  events,
  categories,
  onEventClick,
  maxWalkingMinutes = 20,
  limit = 6,
}: WalkingDistanceSectionProps) {
  const { location: userLocation, status, request } = useUserLocation();
  const { data: venues = [] } = useVenues();

  const nearby = useMemo(() => {
    if (!userLocation) return [];
    const venueById = new Map(venues.map((v) => [v.id, v]));
    const withDistance = events
      .map((e) => {
        const v = venueById.get(e.venueId);
        if (!v?.lat || !v?.lng) return null;
        const meters = haversineMeters(
          userLocation.lat,
          userLocation.lng,
          v.lat,
          v.lng,
        );
        const mins = walkingMinutes(meters);
        if (mins > maxWalkingMinutes) return null;
        return { event: e, walkingMins: mins };
      })
      .filter((x): x is { event: BarlinEvent; walkingMins: number } => x !== null);

    withDistance.sort((a, b) => a.walkingMins - b.walkingMins);
    return withDistance.slice(0, limit);
  }, [events, venues, userLocation, maxWalkingMinutes, limit]);

  // Don't render anything when the user has explicitly denied permission —
  // they made a choice; respect it. The map page is the fallback for
  // browsing nearby events when location is unavailable.
  if (status === "denied") return null;

  return (
    <section className="border-t border-border bg-background">
      <div className="container py-10 md:py-12">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="font-heading text-2xl md:text-3xl font-extrabold uppercase tracking-tight">
            Close Tonight
          </h2>
        </div>

        {status === "idle" && <PermissionEmptyState onRequest={request} />}
        {status === "loading" && <LoadingState />}
        {status === "granted" && nearby.length === 0 && <NoNearbyState />}
        {status === "granted" && nearby.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {nearby.map(({ event, walkingMins }) => (
              <NearbyRow
                key={event.id}
                event={event}
                walkingMins={walkingMins}
                categories={categories}
                onClick={onEventClick}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PermissionEmptyState({ onRequest }: { onRequest: () => void }) {
  return (
    <div className="border-2 border-dashed border-border bg-muted/30 p-6 md:p-8 text-center">
      <p className="font-body text-base md:text-lg text-foreground mb-1">
        See what's tonight near you
      </p>
      <p className="text-sm text-muted-foreground mb-5">
        Allow location to find events within a 20-minute walk.
      </p>
      <button
        type="button"
        onClick={onRequest}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background font-mono font-bold text-xs uppercase tracking-wider hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        Show nearby events
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function LoadingState() {
  // Same dashed-box shell as PermissionEmptyState/NoNearbyState so the
  // section keeps a stable height while the geolocation popup is open.
  // Otherwise the box collapses to a thin line and yanks everything below
  // upward — that's the "auseinanderfliegen" the user noticed.
  return (
    <div className="border-2 border-dashed border-border bg-muted/30 p-6 md:p-8 text-center">
      <p className="font-body text-base md:text-lg text-foreground mb-1">
        Finding events near you
      </p>
      <p className="text-sm text-muted-foreground mb-5">
        Waiting for your location…
      </p>
      <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground/40 text-background font-mono font-bold text-xs uppercase tracking-wider cursor-progress">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Locating
      </span>
    </div>
  );
}

function NoNearbyState() {
  return (
    <div className="border-2 border-dashed border-border bg-muted/30 p-6 md:p-8 text-center">
      <p className="font-body text-base md:text-lg text-foreground mb-1">
        Nothing within a 20-minute walk tonight
      </p>
      <p className="text-sm text-muted-foreground mb-5">
        The map gives you a wider view of what's on tonight.
      </p>
      <Link
        to="/map"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background font-mono font-bold text-xs uppercase tracking-wider hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <MapIcon className="h-3.5 w-3.5" />
        Open map
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

interface NearbyRowProps {
  event: BarlinEvent;
  walkingMins: number;
  categories: CategoryRow[];
  onClick: (eventId: string) => void;
}

function NearbyRow({ event, walkingMins, categories, onClick }: NearbyRowProps) {
  const displayTitle = cleanEventTitle(event.title, event.venue);
  const categoryInfo = categories.find((c) => c.id === event.category);
  const categoryColor = categoryInfo?.color;
  const categoryLabel = categoryInfo?.label ?? event.category;
  const isCanceled = event.status === "canceled";
  const badge = getEventBadge(event, event.interestedCount ?? 0);
  const isPastEvent = badge?.label === "Might be over" || badge?.label === "Over";

  return (
    <button
      onClick={() => onClick(event.id)}
      className={`group flex items-stretch gap-3 text-left bg-background border-2 border-border hover:border-foreground transition-colors overflow-hidden ${
        isCanceled || isPastEvent ? "opacity-60" : ""
      }`}
    >
      {/* Walking-time block — visual anchor of the row. */}
      <div className="shrink-0 flex flex-col items-center justify-center px-3 md:px-4 py-2 bg-muted border-r-2 border-border">
        <span className="font-heading text-2xl md:text-3xl font-extrabold leading-none">
          {walkingMins}
        </span>
        <span className="mono-label text-muted-foreground mt-0.5">min</span>
      </div>

      <div className="flex-1 min-w-0 py-2.5 pr-3">
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
        </div>
        <h3 className="font-body text-base md:text-lg font-bold leading-snug group-hover:text-accent transition-colors line-clamp-1">
          {displayTitle}
        </h3>
        <p className="text-xs text-muted-foreground truncate">{event.venue}</p>
      </div>
    </button>
  );
}
