import { useState, useEffect } from "react";
import { MapPin, Clock, Calendar, Globe, Tag, ExternalLink, RotateCw, Navigation, ArrowLeft } from "lucide-react";
import ShareMenu from "@/components/events/ShareMenu";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatDateWithDay, formatDateShort } from "@/lib/dateFormat";
import { useEventById, useEventsByVenue, useEventsByParent, useCategories } from "@/hooks/useSupabaseData";


interface EventDetailDialogProps {
  eventId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventChange?: (eventId: string) => void;
}

export default function EventDetailDialog({ eventId, open, onOpenChange, onEventChange }: EventDetailDialogProps) {
  const { data: event } = useEventById(eventId ?? undefined);
  const { data: allVenueEvents = [] } = useEventsByVenue(event?.venueId);
  const { data: siblings = [] } = useEventsByParent(event?.parentId);
  const { data: categoryInfos = [] } = useCategories();
  const [joined, setJoined] = useState(false);
  const [interestedCount, setInterestedCount] = useState(0);

  useEffect(() => {
    setJoined(false);
    setInterestedCount(0);
  }, [eventId]);

  const otherEvents = allVenueEvents.filter(e => e.id !== event?.id && e.parentId !== event?.parentId);
  const siblingDates = siblings.map(e => e.date).filter((d, i, arr) => arr.indexOf(d) === i).sort();
  const catInfo = event ? categoryInfos.find(c => c.label === event.category) : null;

  if (!event) return null;

  const handleJoin = () => {
    setJoined(!joined);
    setInterestedCount(prev => joined ? prev - 1 : prev + 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl md:max-h-[90vh] p-0 md:border border-border gap-0 bg-background" fullscreenMobile>
        <DialogTitle className="sr-only">{event.title}</DialogTitle>
        <div className="relative py-3 px-6 md:hidden">
          <button
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-1.5 px-3 py-2 bg-background/90 backdrop-blur-sm border border-border text-foreground text-xs font-heading tracking-wider uppercase hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        <div className="px-6 pt-6 pb-8">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <h2 className="heading-display text-2xl md:text-4xl text-foreground">{event.title}</h2>
            <div className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 border border-foreground bg-card">
              <MapPin className="h-4 w-4 flex-shrink-0 text-accent" />
              <span className="font-heading text-base tracking-wide uppercase">{event.venue}</span>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border border-border bg-card mt-6">
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-border hover:border-foreground hover:text-foreground transition-colors"
              >
                <Navigation className="h-3 w-3" /> Open in Google Maps
              </a>
            )}
            {event.language && <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-muted-foreground font-mono bg-muted border border-border"><Globe className="h-3 w-3" /> {event.language}</span>}
            {event.recurrence && <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-muted-foreground font-mono bg-muted border border-border"><RotateCw className="h-3 w-3" /> {event.recurrence}</span>}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleJoin}
              className={`flex-1 h-11 text-sm tracking-wider font-heading uppercase transition-all ${
                joined
                  ? "bg-accent text-accent-foreground border border-accent"
                  : "bg-foreground text-background border border-foreground hover:bg-foreground/85"
              }`}
            >
              {joined ? "Count me in" : "I want to join"}
            </button>
            {event.url && (
              <a href={event.url} target="_blank" rel="noopener noreferrer" className="h-11 px-4 border border-border text-sm hover:border-foreground transition-colors flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <ShareMenu eventTitle={event.title} eventId={event.id} />
          </div>

          <div className="mt-8 space-y-3">
            <h3 className="font-heading text-base tracking-wide uppercase text-foreground">About this event</h3>
            {event.description.split("\n\n").map((p, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">{p}</p>
            ))}
          </div>

          {siblingDates.length > 1 && (
            <div className="mt-8">
              <h3 className="font-heading text-base tracking-wide uppercase text-foreground mb-3">Upcoming dates</h3>
              <div className="flex flex-wrap gap-2">
                {siblingDates.map(d => {
                  const siblingEvent = siblings.find(e => e.date === d);
                  const isActive = d === event.date;
                  return (
                    <button
                      key={d}
                      onClick={() => {
                        if (!isActive && siblingEvent && onEventChange) {
                          onEventChange(siblingEvent.id);
                        }
                      }}
                      className={`inline-flex items-center px-3 py-1.5 text-xs font-mono border transition-colors ${
                        isActive
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground cursor-pointer'
                      }`}
                    >
                      {formatDateShort(d)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}