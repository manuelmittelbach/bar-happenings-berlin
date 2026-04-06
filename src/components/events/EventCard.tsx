import { useMemo } from "react";
import { Link } from "react-router-dom";
import { formatDateShort } from "@/lib/dateFormat";
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

  // Deterministic pseudo-random interested count based on event id
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
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: index * 0.03 }}
      >
        <Link to={`/event/${event.id}`} onClick={handleClick} className="group flex gap-4 py-4 border-b-2 border-border hover:border-foreground transition-colors">
          <div className="relative w-28 h-28 shrink-0 overflow-hidden bg-muted">
            <EventImage className="grayscale-hover" />
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
          className="group block relative p-6 bg-background border-[3px] border-accent transition-all shadow-[0_0_20px_hsl(var(--accent)/0.15)] hover:shadow-[0_0_30px_hsl(var(--accent)/0.3)]"
        >
          <div className="absolute -top-3 left-4 inline-flex items-center gap-1.5 bg-accent text-accent-foreground px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider shadow-md">
            <Star className="h-3 w-3" />
            Team Pick
          </div>
          <div className="flex items-center gap-2 mb-3 mt-1">
            <span className="mono-label text-accent">{event.category}</span>
          </div>
          <h3 className="font-body text-2xl md:text-3xl font-bold leading-snug group-hover:text-accent transition-colors line-clamp-2 mb-2">
            {event.title}
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
      <Link to={`/event/${event.id}`} onClick={handleClick} className="group block border-2 border-border hover:border-foreground transition-colors p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="mono-label text-accent">{event.category}</span>
        </div>
        <h3 className="font-body text-xl md:text-2xl font-bold leading-snug group-hover:text-accent transition-colors line-clamp-2 mb-2">
          {event.title}
        </h3>
        <p className="text-sm text-muted-foreground font-medium mb-2">{event.venue}</p>
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
      </Link>
    </motion.div>
  );
}
