import { useState } from "react";
import { MapPin, Clock, Calendar, Globe, Tag, ExternalLink, RotateCw, Navigation } from "lucide-react";
import ShareMenu from "@/components/events/ShareMenu";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatDateWithDay, formatDateShort } from "@/lib/dateFormat";
import { getEventById, getVenueById, getEventsByVenue, getEventsByParent, getCategoryInfoByLabel } from "@/data/mockData";
import { getCategoryImage } from "@/assets/categories";

interface EventDetailDialogProps {
  eventId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EventDetailDialog({ eventId, open, onOpenChange }: EventDetailDialogProps) {
  const event = eventId ? getEventById(eventId) : null;
  const [joined, setJoined] = useState(false);
  const [interestedCount, setInterestedCount] = useState(0);

  const venue = event ? getVenueById(event.venueId) : null;
  const otherEvents = event ? getEventsByVenue(event.venueId).filter(e => e.id !== event.id && e.parentId !== event.parentId) : [];
  const siblingDates = event ? getEventsByParent(event.parentId).map(e => e.date).filter((d, i, arr) => arr.indexOf(d) === i).sort() : [];
  const catInfo = event ? getCategoryInfoByLabel(event.category) : null;

  if (!event) return null;

  const handleJoin = () => {
    setJoined(!joined);
    setInterestedCount(prev => joined ? prev - 1 : prev + 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 border-2 border-foreground gap-0">
        <DialogTitle className="sr-only">{event.title}</DialogTitle>
        {/* Hero */}
        <div className="relative h-[240px] md:h-[300px] bg-muted overflow-hidden">
          <img
            src={event.image || getCategoryImage(catInfo?.id || 'other')}
            alt={event.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
        </div>

        <div className="px-6 -mt-16 relative z-10 pb-8">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <h2 className="heading-display text-2xl md:text-4xl">{event.title}</h2>
            <div className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 border-2 border-foreground bg-background">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="font-heading text-base font-bold uppercase tracking-wide">{event.venue}</span>
            </div>
          </motion.div>

          {/* Details grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-2 border-border mt-6">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Date</span>
              <p className="text-sm font-medium">{formatDateWithDay(event.date)}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Time</span>
              <p className="text-sm font-medium">{event.startTime}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Location</span>
              <p className="text-sm font-medium">{event.address || event.neighborhood}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3" /> Price</span>
              <p className="text-sm font-medium">{event.price}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            {event.address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border-2 border-border hover:border-foreground hover:bg-muted transition-colors"
              >
                <Navigation className="h-3 w-3" /> Open in Google Maps
              </a>
            )}
            {event.language && <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-muted-foreground font-mono bg-muted border border-border"><Globe className="h-3 w-3" /> {event.language}</span>}
            {event.recurrence && <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-muted-foreground font-mono bg-muted border border-border"><RotateCw className="h-3 w-3" /> {event.recurrence}</span>}
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleJoin}
              className={`flex-1 h-11 text-sm font-bold uppercase tracking-wider font-heading transition-all ${
                joined
                  ? "bg-accent text-accent-foreground border-2 border-accent"
                  : "bg-foreground text-background border-2 border-foreground hover:bg-background hover:text-foreground"
              }`}
            >
              {joined ? "✓ Interested" : "I want to join"}
            </button>
            {event.url && (
              <a href={event.url} target="_blank" rel="noopener noreferrer" className="h-11 px-4 border-2 border-border text-sm hover:bg-muted transition-colors flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <ShareMenu eventTitle={event.title} eventId={event.id} />
          </div>

          {/* Description */}
          <div className="mt-8 space-y-3">
            <h3 className="font-heading text-base font-bold uppercase">About this event</h3>
            {event.description.split("\n\n").map((p, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">{p}</p>
            ))}
          </div>

          {/* Upcoming dates */}
          {siblingDates.length > 1 && (
            <div className="mt-8">
              <h3 className="font-heading text-base font-bold uppercase mb-3">Upcoming dates</h3>
              <div className="flex flex-wrap gap-2">
                {siblingDates.map(d => (
                  <span key={d} className={`inline-flex items-center px-3 py-1.5 text-xs font-mono border-2 ${d === event.date ? 'border-accent bg-accent text-accent-foreground' : 'border-border text-muted-foreground'}`}>
                    {formatDateShort(d)}
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
