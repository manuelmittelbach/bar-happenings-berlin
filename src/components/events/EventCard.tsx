import { useMemo } from "react";
import { Link } from "react-router-dom";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { getEventBadge, type EventBadge } from "@/lib/eventBadges";
import { MapPin, Star, Users } from "lucide-react";


import type { BarlinEvent } from "@/types/event";
import { useUserLocation } from "@/hooks/useUserLocation";
import { useVenues } from "@/hooks/useEvents";
import { haversineMeters, walkingMinutes } from "@/lib/distance";
import { SHOW_INTEREST_COUNT } from "@/lib/featureFlags";

interface EventCardProps {
  event: BarlinEvent;
  index?: number;
  layout?: "grid" | "list";
  featured?: boolean;
  onClick?: (eventId: string) => void;
}

/* Compact chip styles per badge variant */
const badgeChipClasses: Record<EventBadge["variant"], string> = {
  soon: "bg-muted text-foreground border border-border",
  popular: "border border-accent/40 text-accent bg-accent/10",
};


export default function EventCard({ event, layout = "grid", featured = false, onClick }: EventCardProps) {
  const displayTitle = useMemo(() => cleanEventTitle(event.title, event.venue), [event.title, event.venue]);
  const { location: userLocation } = useUserLocation();
  const { data: venues = [] } = useVenues();
  const isCanceled = event.status === "canceled";

  const interestedCount = event.interestedCount ?? 0;

  const badge = useMemo(() => getEventBadge(event, interestedCount), [event, interestedCount]);

  const walkingMins = useMemo(() => {
    if (!userLocation) return null;
    const venue = venues.find((v) => v.id === event.venueId);
    if (!venue?.lat || !venue?.lng) return null;
    const meters = haversineMeters(userLocation.lat, userLocation.lng, venue.lat, venue.lng);
    return walkingMinutes(meters);
  }, [userLocation, event.venueId, venues]);

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick(event.id);
    }
  };


  const BadgeChip = () => {
    if (!badge) return null;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-body font-extrabold uppercase tracking-wide ${badgeChipClasses[badge.variant]}`}>
        <badge.icon className="h-2.5 w-2.5" />
        {badge.label}
      </span>
    );
  };

  const LocationChip = ({ size = "sm" }: { size?: "xs" | "sm" }) => {
    const textClass = size === "xs" ? "text-[10px] md:text-xs" : "text-xs";
    const iconClass = size === "xs" ? "h-3 w-3 md:h-3.5 md:w-3.5" : "h-3.5 w-3.5";
    const padClass = size === "xs" ? "px-1.5 md:px-2" : "px-2";

    if (walkingMins !== null && walkingMins <= 30) {
      return (
        <span className={`inline-flex items-center gap-1 ${padClass} py-0.5 bg-muted border border-border ${textClass} text-foreground font-mono`}>
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 4a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M7 21l3 -4"/><path d="M16 21l-2 -4l-3 -3l1 -6"/><path d="M6 12l2 -3l4 -1l3 3l3 1"/></svg>
          {walkingMins} min
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center gap-1 ${padClass} py-0.5 bg-muted border border-border ${textClass} text-muted-foreground font-mono`}>
        <MapPin className={iconClass} />
        {event.neighborhood}
      </span>
    );
  };

  const canceledLabel = event.canceledBy === "admin" ? "Canceled" : "Canceled by the organizer";
  const canceledOverlay = isCanceled ? (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
      <span className="-rotate-12 border-2 border-red-600 text-red-600 bg-background/80 font-body text-[10px] md:text-xs font-extrabold uppercase tracking-wider px-2.5 py-1 shadow-md whitespace-nowrap">
        {canceledLabel}
      </span>
    </div>
  ) : null;

  /* ─── LIST layout ─── */
  if (layout === "list") {
    return (
      <div className="relative">
        {canceledOverlay}
        <Link to={`/event/${event.id}`} onClick={handleClick} className={`group flex gap-4 py-4 border-b-2 border-border hover:border-foreground transition-colors card-hover-lift ${isCanceled ? "opacity-50" : ""}`}>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="mono-label text-accent font-bold">{event.category}</span>
              <span className="mono-label text-muted-foreground">·</span>
              <span className="mono-label text-muted-foreground">{event.neighborhood}</span>
              <BadgeChip />
            </div>
            <h3 className="font-body text-xl md:text-2xl font-bold leading-snug group-hover:text-accent transition-colors truncate">
              {displayTitle}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <LocationChip size="sm" />
              {SHOW_INTEREST_COUNT && (
                <span className="inline-flex items-center gap-1 text-xs text-accent font-mono">
                  <Users className="h-3.5 w-3.5" />
                  {interestedCount}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{event.description}</p>
          </div>
        </Link>
      </div>
    );
  }

  /* ─── FEATURED layout ─── */
  if (featured) {
    return (
      <div className="col-span-1 relative">
        {canceledOverlay}
        <Link
          to={`/event/${event.id}`}
          onClick={handleClick}
          className={`group flex flex-col md:flex-row relative bg-background border-[3px] border-accent transition-all shadow-[0_0_20px_hsl(var(--accent)/0.15)] hover:shadow-[0_0_30px_hsl(var(--accent)/0.3)] overflow-hidden card-hover-lift ${isCanceled ? "opacity-50" : ""}`}
        >
          <div className="p-4 md:p-6 flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <div className="inline-flex items-center gap-1.5 bg-accent text-accent-foreground px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider shadow-md">
                <Star className="h-3 w-3" />
                Team Pick
              </div>
              <BadgeChip />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="mono-label text-accent font-bold">{event.category}</span>
            </div>
            <h3 className="font-body text-2xl md:text-3xl font-bold leading-snug group-hover:text-accent transition-colors line-clamp-2 mb-2">
              {displayTitle}
            </h3>
            <p className="text-sm text-muted-foreground font-medium mb-1">{event.venue}</p>
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{event.description}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <LocationChip size="sm" />
              {SHOW_INTEREST_COUNT && (
                <span className="inline-flex items-center gap-1 text-xs text-accent font-mono">
                  <Users className="h-3.5 w-3.5" />
                  {interestedCount}
                </span>
              )}
            </div>
          </div>
        </Link>
      </div>
    );
  }

  /* ─── DEFAULT GRID card ─── */
  const isPastEvent = badge?.label === "Might be over" || badge?.label === "Over";

  return (
    <div className={`relative ${isPastEvent ? "opacity-60" : ""}`}>
      {canceledOverlay}
      <Link
        to={`/event/${event.id}`}
        onClick={handleClick}
        className={`group relative flex flex-col border-2 border-border hover:border-foreground bg-background transition-colors overflow-hidden card-hover-lift ${
          isCanceled ? "opacity-50" : ""
        }`}
      >
        <div className="flex flex-1">
          <div className="p-3 md:p-4 flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="mono-label text-accent font-bold text-[10px] md:text-xs">{event.category}</span>
              <BadgeChip />
            </div>
            <h3 className="font-body text-lg md:text-2xl font-bold leading-tight group-hover:text-accent transition-colors line-clamp-2 mb-1">
              {displayTitle}
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground font-medium mb-1">{event.venue}</p>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <LocationChip size="xs" />
              </div>
              {SHOW_INTEREST_COUNT && (
                <span className="inline-flex items-center gap-1 text-[10px] md:text-xs text-accent font-mono shrink-0">
                  <Users className="h-3 w-3" />
                  {interestedCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
