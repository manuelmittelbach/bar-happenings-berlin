import { Link } from "react-router-dom";
import { formatDateShort } from "@/lib/dateFormat";
import { MapPin, Clock } from "lucide-react";
import { motion } from "framer-motion";
import type { BarlinEvent } from "@/data/mockData";

interface EventCardProps {
  event: BarlinEvent;
  index?: number;
  layout?: "grid" | "list";
  onClick?: (eventId: string) => void;
}

export default function EventCard({ event, index = 0, layout = "grid", onClick }: EventCardProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick(event.id);
    }
  };

  if (layout === "list") {
    return (
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: index * 0.03 }}
      >
        <Link to={`/event/${event.id}`} onClick={handleClick} className="group flex gap-4 py-4 border-b border-border hover:border-foreground transition-colors">
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1">
              <span className="mono-label text-accent">{event.category}</span>
              <span className="mono-label text-muted-foreground">&middot;</span>
              <span className="mono-label text-muted-foreground">{event.neighborhood}</span>
            </div>
            <h3 className="font-heading text-lg md:text-xl tracking-wide leading-tight group-hover:text-accent transition-colors truncate uppercase">
              {event.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">{event.venue} &mdash; {formatDateShort(event.date)} &middot; {event.startTime}</p>
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
      <Link
        to={`/event/${event.id}`}
        onClick={handleClick}
        className="group block bg-card p-5 border border-border hover:border-foreground transition-colors"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="mono-label text-accent">{event.category}</span>
        </div>
        <h3 className="font-heading text-lg md:text-xl tracking-wide leading-tight group-hover:text-accent transition-colors line-clamp-2 uppercase">
          {event.title}
        </h3>
        <p className="text-muted-foreground font-medium mt-2 text-sm">{event.venue}</p>
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