import { Link } from "react-router-dom";
import { formatDateShort } from "@/lib/dateFormat";
import { MapPin, Clock } from "lucide-react";
import { motion } from "framer-motion";
import type { BarlinEvent } from "@/data/mockData";
import { getCategoryInfoByLabel } from "@/data/mockData";

function isTigerPick(eventId: string, index: number): boolean {
  const hash = eventId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return ((hash * 31 + index * 13) % 100) < 5; // ~5%
}

interface EventCardProps {
  event: BarlinEvent;
  index?: number;
  layout?: "grid" | "list";
  onClick?: (eventId: string) => void;
}

export default function EventCard({ event, index = 0, layout = "grid", onClick }: EventCardProps) {
  const catInfo = getCategoryInfoByLabel(event.category);
  const featured = layout === "grid" && isTigerPick(event.id, index);
  
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick(event.id);
    }
  };

  const seed = index * 7 + (event.id.charCodeAt(event.id.length - 1) || 0);
  const rotation = ((seed % 5) - 2) * 0.6;
  const translateY = ((seed % 3) - 1) * 6;

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
      className={`relative ${featured ? "col-span-1 sm:col-span-2 z-10" : ""}`}
    >
      {featured && (
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.4, delay: index * 0.05 + 0.2, type: "spring", stiffness: 200 }}
          className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 px-4 py-1 bg-tiger-gold text-primary-foreground font-heading text-xs tracking-[0.15em] uppercase border-2 border-background shadow-lg whitespace-nowrap"
        >
          🐯 Tiger Pick
        </motion.div>
      )}
      <Link
        to={`/event/${event.id}`}
        onClick={handleClick}
        className={`group block bg-card transition-colors ${
          featured
            ? "p-6 md:p-8 border-[3px] border-tiger-gold shadow-[0_0_30px_-5px_hsl(var(--tiger-gold)/0.4)] hover:shadow-[0_0_40px_-5px_hsl(var(--tiger-gold)/0.6)]"
            : "p-5 border-2 border-border hover:border-tiger-gold"
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="mono-label text-tiger-warm">{event.category}</span>
          {event.entryInfo && (
            <>
              <span className="mono-label text-muted-foreground">&middot;</span>
              <span className="stamp text-tiger-gold border-tiger-gold text-[10px]">{event.entryInfo}</span>
            </>
          )}
        </div>
        <h3 className={`font-heading tracking-wide leading-tight group-hover:text-tiger-gold transition-colors line-clamp-2 ${
          featured ? "text-xl md:text-2xl" : "text-lg md:text-xl"
        }`}>
          {event.title}
        </h3>
        <p className={`text-muted-foreground font-medium mt-2 ${featured ? "text-base" : "text-sm"}`}>{event.venue}</p>
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
