import { Link } from "react-router-dom";
import { MapPin, Clock } from "lucide-react";
import { motion } from "framer-motion";
import type { BarlinEvent } from "@/data/mockData";

interface EventCardProps {
  event: BarlinEvent;
  index?: number;
}

export default function EventCard({ event, index = 0 }: EventCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link to={`/event/${event.id}`} className="group block">
        <div className="relative overflow-hidden rounded-sm aspect-[4/3] bg-muted">
          <img
            src={event.image}
            alt={event.title}
            className="absolute inset-0 w-full h-full object-cover grayscale-hover"
            loading="lazy"
          />
          <div className="absolute top-3 left-3 flex gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-background/90 backdrop-blur-sm rounded-sm text-foreground">
              {event.category}
            </span>
          </div>
          <div className="absolute bottom-3 right-3">
            <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-accent text-accent-foreground rounded-sm">
              {event.entryInfo}
            </span>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <h3 className="font-heading text-base font-semibold leading-tight group-hover:text-accent transition-colors line-clamp-2">
            {event.title}
          </h3>
          <p className="text-sm text-muted-foreground font-medium">{event.venue}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {event.neighborhood}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {event.startTime}
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mt-1">
            {event.summary}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
