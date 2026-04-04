import { Link } from "react-router-dom";
import { formatDateShort } from "@/lib/dateFormat";
import { MapPin, Clock } from "lucide-react";
import { motion } from "framer-motion";
import type { BarlinEvent } from "@/data/mockData";
import { getCategoryInfoByLabel } from "@/data/mockData";

interface EventCardProps {
  event: BarlinEvent;
  index?: number;
  layout?: "grid" | "list" | "compact";
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

  // Deterministic pseudo-random rotation & offset based on index
  const seed = index * 7 + (event.id.charCodeAt(event.id.length - 1) || 0);
  const rotation = ((seed % 5) - 2) * 0.6; // -1.2 to 1.2 deg
  const translateY = ((seed % 3) - 1) * 6; // -6 to 6 px

  if (layout === "list") {
    return (
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: index * 0.03 }}
      >
        <Link to={`/event/${event.id}`} onClick={handleClick} className="group flex gap-4 py-4 border-b-2 border-border hover:border-tiger-gold transition-colors">
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
      style={{ rotate: `${rotation}deg`, translateY: `${translateY}px` }}
      whileHover={{ rotate: 0, translateY: 0, scale: 1.02 }}
    >
      <Link to={`/event/${event.id}`} onClick={handleClick} className="group block p-5 border-2 border-border bg-card hover:border-tiger-gold transition-colors">
        <div className="flex items-center gap-2 mb-2">
          <span className="mono-label text-tiger-warm">{event.category}</span>
          {event.entryInfo && (
            <>
              <span className="mono-label text-muted-foreground">&middot;</span>
              <span className="stamp text-tiger-gold border-tiger-gold text-[10px]">{event.entryInfo}</span>
            </>
          )}
        </div>
        <h3 className="font-heading text-lg md:text-xl tracking-wide leading-tight group-hover:text-tiger-gold transition-colors line-clamp-2">
          {event.title}
        </h3>
        <p className="text-sm text-muted-foreground font-medium mt-2">{event.venue}</p>
        <div className="flex items-center gap-2 flex-wrap mt-3">
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
      </Link>
    </motion.div>
  );
}
