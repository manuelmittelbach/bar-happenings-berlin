import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import type { Venue, BarlinEvent } from "@/types/event";

interface VenueBlockProps {
  venue: Venue;
  otherEvents: BarlinEvent[];
}

export default function VenueBlock({ venue, otherEvents }: VenueBlockProps) {
  return (
    <div className="border border-border rounded-sm p-6 space-y-4">
      <div className="flex gap-4">
        <div className="w-20 h-20 rounded-sm overflow-hidden flex-shrink-0 bg-muted">
          <img src={venue.image} alt={venue.name} className="w-full h-full object-cover" />
        </div>
        <div className="space-y-1">
          <h4 className="font-heading text-base font-semibold">{venue.name}</h4>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {venue.neighborhood} · {venue.address}
          </p>
          {venue.instagram && (
            <p className="text-xs text-accent">{venue.instagram}</p>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{venue.description}</p>
      {otherEvents.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            More at this venue
          </h5>
          {otherEvents.slice(0, 3).map((ev) => (
            <Link
              key={ev.id}
              to={`/event/${ev.id}`}
              className="block text-sm hover:text-accent transition-colors"
            >
              {ev.title} · {ev.date} · {ev.startTime}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
