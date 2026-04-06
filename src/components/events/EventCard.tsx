import { useMemo } from "react";
import { Link } from "react-router-dom";
import { formatDateShort } from "@/lib/dateFormat";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { getEventBadge, type EventBadge } from "@/lib/eventBadges";
import { MapPin, Clock, Star, Users } from "lucide-react";
import { motion } from "framer-motion";
import type { BarlinEvent } from "@/data/mockData";
import { getCategoryInfoByLabel } from "@/data/mockData";
import { getCategoryImage } from "@/assets/categories";
import { getVenueImage } from "@/assets/venues";

interface EventCardProps {
  event: BarlinEvent;
  index?: number;
  layout?: "grid" | "list";
  featured?: boolean;
  onClick?: (eventId: string) => void;
}

export default function EventCard({ event, index = 0, layout = "grid", featured = false, onClick }: EventCardProps) {
  const catInfo = getCategoryInfoByLabel(event.category);
  const displayTitle = useMemo(() => cleanEventTitle(event.title, event.venue), [event.title, event.venue]);

  // Deterministic pseudo-random interested count based on event id
  const interestedCount = useMemo(() => {
    const hash = event.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return (hash % 42) + 1;
  }, [event.id]);

  const badge = useMemo(() => getEventBadge(event, interestedCount), [event, interestedCount]);

  const badgeVariantClasses: Record<EventBadge["variant"], string> = {
    live: "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-[0_0_12px_hsl(0_72%_51%/0.5)]",
    soon: "bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-foreground shadow-[0_0_10px_hsl(var(--primary)/0.4)]",
    popular: "bg-gradient-to-r from-[hsl(var(--accent))] to-pink-500 text-white shadow-[0_0_10px_hsl(var(--accent)/0.4)]",
  };
  
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick(event.id);
    }
  };

  const fallbackImage = getVenueImage(event.venueId) || getCategoryImage(catInfo?.id || 'other');

  const EventImage = ({ className = "" }: { className?: string }) => (
    <img
      src={event.image || fallbackImage}
      alt={event.title}
      className={`absolute inset-0 w-full h-full object-cover ${className}`}
      loading="lazy"
    />
  );

  if (layout === "list") {
    return (
      <div>
        <Link to={`/event/${event.id}`} onClick={handleClick} className="group flex gap-4 py-4 border-b-2 border-border hover:border-foreground transition-colors">
          <div className="relative w-24 sm:w-28 shrink-0 self-stretch overflow-hidden bg-muted">
            <EventImage className="grayscale-hover" />
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1">
              <span className="mono-label text-accent font-bold">{event.category}</span>
              <span className="mono-label text-muted-foreground">·</span>
              <span className="mono-label text-muted-foreground">{event.neighborhood}</span>
              {badge && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-heading font-bold uppercase tracking-wide -rotate-1 ${badgeVariantClasses[badge.variant]} ${badge.variant === "live" ? "animate-pulse" : ""}`}>
                  <badge.icon className="h-3 w-3" />
                  {badge.label}
                </span>
              )}
            </div>
            <h3 className="font-body text-xl md:text-2xl font-bold leading-snug group-hover:text-accent transition-colors truncate">
              {displayTitle}
            </h3>
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-sm text-muted-foreground">{event.venue} — {formatDateShort(event.date)} · {event.startTime}</p>
              <span className="inline-flex items-center gap-1 text-xs text-accent font-mono">
                <Users className="h-3.5 w-3.5" />
                {interestedCount}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{event.description}</p>
          </div>
        </Link>
      </div>
    );
  }

  if (featured) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: index * 0.05 }}
        className="col-span-1"
      >
        <Link
          to={`/event/${event.id}`}
          onClick={handleClick}
          className="group flex flex-col md:flex-row relative bg-background border-[3px] border-accent transition-all shadow-[0_0_20px_hsl(var(--accent)/0.15)] hover:shadow-[0_0_30px_hsl(var(--accent)/0.3)] overflow-hidden"
        >
          {/* Image — square on desktop side, 16:9 banner on mobile top */}
          <div className="relative w-full aspect-[16/9] md:w-48 md:h-auto md:aspect-square shrink-0 bg-muted flex items-center justify-center">
            {event.image ? (
              <img src={event.image} alt={event.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            ) : (
              <span className="mono-label text-muted-foreground/30 text-[9px]">No img</span>
            )}
          </div>
          <div className="p-4 md:p-6 flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <div className="inline-flex items-center gap-1.5 bg-accent text-accent-foreground px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider shadow-md">
                <Star className="h-3 w-3" />
                Team Pick
              </div>
              {badge && (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-heading font-bold uppercase tracking-wide -rotate-1 ${badgeVariantClasses[badge.variant]} ${badge.variant === "live" ? "animate-pulse" : ""}`}>
                  <badge.icon className="h-3 w-3" />
                  {badge.label}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="mono-label text-accent font-bold">{event.category}</span>
            </div>
            <h3 className="font-body text-2xl md:text-3xl font-bold leading-snug group-hover:text-accent transition-colors line-clamp-2 mb-2">
              {displayTitle}
            </h3>
            <p className="text-sm text-muted-foreground font-medium mb-1">{event.venue}</p>
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{event.description}</p>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted border border-border text-xs text-muted-foreground font-mono">
                  <MapPin className="h-3 w-3" />
                  {event.neighborhood}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted border border-border text-xs text-muted-foreground font-mono">
                  <Clock className="h-3 w-3" />
                  {formatDateShort(event.date)}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-accent font-mono">
                <Users className="h-3.5 w-3.5" />
                {interestedCount}
              </span>
            </div>
          </div>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link to={`/event/${event.id}`} onClick={handleClick} className="group flex flex-col border-2 border-border hover:border-foreground transition-colors overflow-hidden">
        {/* Badge strip — flush with card top */}
        {badge && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-heading font-bold uppercase tracking-wide ${badgeVariantClasses[badge.variant]} ${badge.variant === "live" ? "animate-pulse" : ""}`}>
            <badge.icon className="h-3 w-3" />
            {badge.label}
          </div>
        )}
        <div className="flex flex-1">
          {/* Image thumbnail */}
          <div className="relative w-24 sm:w-32 md:w-40 shrink-0 self-stretch bg-muted flex items-center justify-center overflow-hidden">
            {event.image ? (
              <img src={event.image} alt={event.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            ) : (
              <span className="mono-label text-muted-foreground/30 text-[9px]">No img</span>
            )}
          </div>
          <div className="p-3 md:p-4 flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="mono-label text-accent font-bold text-[10px] md:text-xs">{event.category}</span>
            </div>
            <h3 className="font-body text-lg md:text-2xl font-bold leading-tight group-hover:text-accent transition-colors line-clamp-2 mb-1">
              {displayTitle}
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground font-medium mb-1">{event.venue}</p>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 bg-muted border border-border text-[10px] md:text-xs text-muted-foreground font-mono">
                  <MapPin className="h-2.5 w-2.5 md:h-3 md:w-3" />
                  {event.neighborhood}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-muted border border-border text-xs text-muted-foreground font-mono">
                  <Clock className="h-3 w-3" />
                  {formatDateShort(event.date)}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] md:text-xs text-accent font-mono shrink-0">
                <Users className="h-3 w-3" />
                {interestedCount}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
