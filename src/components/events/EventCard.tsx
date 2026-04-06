import { useMemo } from "react";
import { Link } from "react-router-dom";
import { formatDateShort } from "@/lib/dateFormat";
import { MapPin, Clock, Star, Users, Zap } from "lucide-react";
import { motion } from "framer-motion";
import type { BarlinEvent } from "@/data/mockData";
import { getCategoryInfoByLabel } from "@/data/mockData";
import { getCategoryImage } from "@/assets/categories";
import { getVenueImage } from "@/assets/venues";

interface EventCardProps {
  event: BarlinEvent;
  index?: number;
  layout?: "grid" | "list" | "compact";
  featured?: boolean;
  onClick?: (eventId: string) => void;
}

export default function EventCard({ event, index = 0, layout = "grid", featured = false, onClick }: EventCardProps) {
  const catInfo = getCategoryInfoByLabel(event.category);

  const interestedCount = useMemo(() => {
    const hash = event.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return (hash % 42) + 1;
  }, [event.id]);
  
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick(event.id);
    }
  };

  const fallbackImage = getVenueImage(event.venueId) || getCategoryImage(catInfo?.id || 'other');

  /* ── Compact: minimal single-line for secondary results ── */
  if (layout === "compact") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: index * 0.02 }}
      >
        <Link
          to={`/event/${event.id}`}
          onClick={handleClick}
          className="group flex items-center gap-3 py-3 px-4 border-b border-border hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-accent font-mono text-[10px] uppercase tracking-wider font-bold shrink-0 w-16 truncate">
              {event.startTime}
            </span>
            <span className="w-px h-4 bg-border shrink-0" />
            <h4 className="font-body text-sm font-semibold truncate group-hover:text-accent transition-colors">
              {event.title}
            </h4>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[100px] hidden sm:inline">
              {event.venue}
            </span>
            <span className="inline-flex items-center gap-0.5 text-[10px] text-accent font-mono">
              <Users className="h-3 w-3" />
              {interestedCount}
            </span>
          </div>
        </Link>
      </motion.div>
    );
  }

  /* ── List layout ── */
  if (layout === "list") {
    return (
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: index * 0.03 }}
      >
        <Link to={`/event/${event.id}`} onClick={handleClick} className="group flex gap-4 py-4 border-b-2 border-border hover:border-foreground transition-colors">
          <div className="relative w-28 h-28 shrink-0 overflow-hidden bg-muted">
            <img src={event.image || fallbackImage} alt={event.title} className="absolute inset-0 w-full h-full object-cover grayscale-hover" loading="lazy" />
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1">
              <span className="mono-label text-accent">{event.category}</span>
              <span className="mono-label text-muted-foreground">·</span>
              <span className="mono-label text-muted-foreground">{event.neighborhood}</span>
            </div>
            <h3 className="font-body text-xl md:text-2xl font-bold leading-snug group-hover:text-accent transition-colors truncate">
              {event.title}
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
      </motion.div>
    );
  }

  /* ── Featured: hero-style large card with image ── */
  if (featured) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: index * 0.05 }}
        className="shrink-0 w-[340px] sm:w-[400px] snap-start"
      >
        <Link
          to={`/event/${event.id}`}
          onClick={handleClick}
          className="group block relative overflow-hidden border-2 border-accent hover:border-accent transition-all shadow-[0_0_20px_hsl(var(--accent)/0.1)] hover:shadow-[0_0_30px_hsl(var(--accent)/0.25)]"
        >
          {/* Image */}
          <div className="relative h-48 overflow-hidden bg-muted">
            <img
              src={event.image || fallbackImage}
              alt={event.title}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
            {/* Badge */}
            <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-accent text-accent-foreground px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider">
              <Star className="h-3 w-3" />
              Team Pick
            </div>
            {/* Interested overlay */}
            <div className="absolute top-3 right-3 inline-flex items-center gap-1 bg-background/80 backdrop-blur-sm px-2 py-1 text-[10px] font-mono text-accent">
              <Users className="h-3 w-3" />
              {interestedCount}
            </div>
          </div>
          {/* Content */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 border border-accent/30 text-[10px] text-accent font-mono uppercase tracking-wider">
                {event.category}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {formatDateShort(event.date)} · {event.startTime}
              </span>
            </div>
            <h3 className="font-heading text-lg font-bold leading-snug group-hover:text-accent transition-colors line-clamp-2 mb-1.5">
              {event.title}
            </h3>
            <p className="text-sm text-muted-foreground font-medium">{event.venue}</p>
          </div>
        </Link>
      </motion.div>
    );
  }

  /* ── Standard grid card ── */
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link to={`/event/${event.id}`} onClick={handleClick} className="group block border-2 border-border hover:border-foreground transition-colors">
        {/* Mini image strip */}
        <div className="relative h-32 overflow-hidden bg-muted">
          <img
            src={event.image || fallbackImage}
            alt={event.title}
            className="absolute inset-0 w-full h-full object-cover grayscale-hover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-background/80 backdrop-blur-sm text-[10px] text-accent font-mono uppercase tracking-wider">
              {event.category}
            </span>
            <span className="inline-flex items-center gap-1 bg-background/80 backdrop-blur-sm px-1.5 py-0.5 text-[10px] text-accent font-mono">
              <Users className="h-3 w-3" />
              {interestedCount}
            </span>
          </div>
        </div>
        {/* Content */}
        <div className="p-3.5">
          <h3 className="font-heading text-base font-bold leading-snug group-hover:text-accent transition-colors line-clamp-2 mb-1.5">
            {event.title}
          </h3>
          <p className="text-xs text-muted-foreground font-medium mb-2 truncate">{event.venue}</p>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
              <MapPin className="h-3 w-3" />
              {event.neighborhood}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
              <Clock className="h-3 w-3" />
              {formatDateShort(event.date)} · {event.startTime}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
