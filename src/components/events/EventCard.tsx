import { Link } from "react-router-dom";
import { formatDateShort } from "@/lib/dateFormat";
import { MapPin, Clock } from "lucide-react";
import { motion } from "framer-motion";
import type { BarlinEvent } from "@/data/mockData";
import { getCategoryInfoByLabel } from "@/data/mockData";
import { getCategoryImage } from "@/assets/categories";


interface EventCardProps {
  event: BarlinEvent;
  index?: number;
  layout?: "grid" | "list";
  onClick?: (eventId: string) => void;
}

export default function EventCard({ event, index = 0, layout = "grid", onClick }: EventCardProps) {
  const catInfo = getCategoryInfoByLabel(event.category);
  
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick(event.id);
    }
  };

  const illustrationImage = getCategoryImage(catInfo?.id || 'other');

  const EventImage = ({ className = "" }: { className?: string }) => (
    <img
      src={illustrationImage}
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
        <Link to={`/event/${event.id}`} onClick={handleClick} className="group flex gap-4 py-4 border-b-2 border-border hover:border-tiger-gold transition-colors">
          <div className="relative w-28 h-28 shrink-0 overflow-hidden bg-muted">
            <EventImage className="grayscale-hover" />
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1">
              <span className="mono-label text-tiger-warm">{event.category}</span>
              <span className="mono-label text-muted-foreground">&middot;</span>
              <span className="mono-label text-muted-foreground">{event.neighborhood}</span>
            </div>
            <h3 className="font-heading text-lg md:text-xl tracking-wide leading-tight group-hover:text-tiger-gold transition-colors truncate">
              {event.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">{event.venue} &mdash; {formatDateShort(event.date)} &middot; {event.startTime}</p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{event.description}</p>
          </div>
          <div className="hidden sm:flex flex-col items-end justify-center gap-1">
            {event.entryInfo && <span className="stamp text-tiger-gold border-tiger-gold text-[10px]">{event.entryInfo}</span>}
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
      <Link to={`/event/${event.id}`} onClick={handleClick} className="group block">
        <div className="relative overflow-hidden aspect-[16/9] md:aspect-[4/3] bg-muted retro-card">
          <EventImage className="grayscale-hover" />
          <div className="absolute top-3 left-3">
            <span className="mono-label bg-background/90 backdrop-blur-sm px-2 py-1 text-tiger-warm">
              {event.category}
            </span>
          </div>
          {event.entryInfo && (
            <div className="absolute bottom-3 right-3">
              <span className="stamp text-tiger-gold border-tiger-gold bg-background/80 backdrop-blur-sm text-[10px]">
                {event.entryInfo}
              </span>
            </div>
          )}
        </div>
        <div className="mt-3 space-y-2">
          <h3 className="font-heading text-base md:text-lg tracking-wide leading-tight group-hover:text-tiger-gold transition-colors line-clamp-2">
            {event.title}
          </h3>
          <p className="text-sm text-muted-foreground font-medium">{event.venue}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted border border-border text-xs text-muted-foreground font-mono">
              <MapPin className="h-3 w-3" />
              {event.neighborhood}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted border border-border text-xs text-muted-foreground font-mono">
              <Clock className="h-3 w-3" />
              {formatDateShort(event.date)}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted border border-border text-xs text-muted-foreground font-mono">
              {event.startTime}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
