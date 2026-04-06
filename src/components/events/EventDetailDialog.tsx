import { useState, useEffect } from "react";
import { MapPin, Clock, Calendar, Globe, Tag, ExternalLink, RotateCw, Navigation, ArrowLeft, Users, Share2, Bookmark } from "lucide-react";
import ShareMenu from "@/components/events/ShareMenu";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatDateWithDay, formatDateShort } from "@/lib/dateFormat";
import { getEventById, getVenueById, getEventsByVenue, getEventsByParent, getCategoryInfoByLabel } from "@/data/mockData";
import { getCategoryImage } from "@/assets/categories";
import { getVenueImage } from "@/assets/venues";
import { useMemo } from "react";

interface EventDetailDialogProps {
  eventId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventChange?: (eventId: string) => void;
}

export default function EventDetailDialog({ eventId, open, onOpenChange, onEventChange }: EventDetailDialogProps) {
  const event = eventId ? getEventById(eventId) : null;
  const [joined, setJoined] = useState(false);
  const [interestedCount, setInterestedCount] = useState(0);

  const baseCount = useMemo(() => {
    if (!eventId) return 0;
    const hash = eventId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return (hash % 42) + 1;
  }, [eventId]);

  useEffect(() => {
    setJoined(false);
    setInterestedCount(baseCount);
  }, [eventId, baseCount]);

  const venue = event ? getVenueById(event.venueId) : null;
  const siblings = event ? getEventsByParent(event.parentId) : [];
  const siblingDates = siblings.map(e => e.date).filter((d, i, arr) => arr.indexOf(d) === i).sort();
  const catInfo = event ? getCategoryInfoByLabel(event.category) : null;

  if (!event) return null;

  // Only show image if the event has its own image (not generic)
  const hasRealImage = !!event.image;

  const handleJoin = () => {
    setJoined(!joined);
    setInterestedCount(prev => joined ? prev - 1 : prev + 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl md:max-h-[90vh] p-0 md:border-2 md:border-foreground gap-0 overflow-y-auto" fullscreenMobile>
        <DialogTitle className="sr-only">{event.title}</DialogTitle>

        {/* Mobile back button - always visible */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 left-4 z-20 md:hidden flex items-center gap-1.5 px-3 py-2 bg-background/90 backdrop-blur-sm border-2 border-foreground text-foreground text-xs font-heading font-bold uppercase tracking-wider hover:bg-background transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {/* Hero - only if real image */}
        {hasRealImage && (
          <div className="relative h-[220px] md:h-[280px] bg-muted overflow-hidden">
            <img
              src={event.image!}
              alt={event.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          </div>
        )}

        <div className={`px-6 ${hasRealImage ? '-mt-14' : 'pt-14 md:pt-8'} relative z-10 pb-8`}>
          {/* Category & Recurrence tags */}
          <div className="flex items-center gap-2 mb-3">
            {catInfo && (
              <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-accent uppercase tracking-wider">
                {catInfo.emoji} {catInfo.label}
              </span>
            )}
            {event.recurrence && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-mono">
                <RotateCw className="h-3 w-3" /> {event.recurrence}
              </span>
            )}
          </div>

          {/* Title - big and bold */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <h2 className="font-heading text-3xl md:text-4xl font-extrabold leading-tight tracking-tight">
              {event.title}
            </h2>
          </motion.div>

          {/* Key info row - DICE style with accent date */}
          <div className="mt-4 space-y-1.5">
            <p className="text-accent font-heading font-bold text-base">
              {formatDateWithDay(event.date)}, {event.startTime}
            </p>
            <p className="text-foreground font-medium text-base">{event.venue}</p>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {event.neighborhood && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {event.neighborhood}
                </span>
              )}
              {event.language && (
                <span className="inline-flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5" /> {event.language}
                </span>
              )}
            </div>
          </div>

          {/* Interested count */}
          <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
            <Users className="h-4 w-4 text-accent" />
            <span><strong className="text-foreground">{interestedCount}</strong> people interested</span>
          </div>

          {/* Price & CTA bar - inspired by DICE bottom bar */}
          <div className="flex items-center gap-3 mt-6 p-4 bg-card border-2 border-border">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground uppercase font-mono tracking-wider mb-0.5">Entry</p>
              <p className="text-lg font-heading font-bold">{event.price}</p>
            </div>
            <button
              onClick={handleJoin}
              className={`px-6 h-11 text-sm font-bold uppercase tracking-wider font-heading transition-all ${
                joined
                  ? "bg-accent text-accent-foreground border-2 border-accent"
                  : "bg-foreground text-background border-2 border-foreground hover:bg-background hover:text-foreground"
              }`}
            >
              {joined ? "✓ Interested" : "I want to join"}
            </button>
          </div>

          {/* Action row - DICE style */}
          <div className="flex items-center gap-2 mt-4">
            {event.url && (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border-2 border-border hover:border-foreground hover:bg-muted transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Website
              </a>
            )}
            {event.address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border-2 border-border hover:border-foreground hover:bg-muted transition-colors"
              >
                <Navigation className="h-3.5 w-3.5" /> Directions
              </a>
            )}
            <div className="ml-auto">
              <ShareMenu eventTitle={event.title} eventId={event.id} />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border mt-6 mb-6" />

          {/* Description */}
          <div className="space-y-3">
            <h3 className="font-heading text-base font-bold uppercase tracking-wide">About this event</h3>
            {event.description.split("\n\n").map((p, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">{p}</p>
            ))}
          </div>

          {/* Address details */}
          {event.address && (
            <div className="mt-6 p-4 bg-card border border-border">
              <h3 className="font-heading text-sm font-bold uppercase tracking-wide mb-2">Venue</h3>
              <p className="text-sm font-medium">{event.venue}</p>
              <p className="text-xs text-muted-foreground mt-1">{event.address}</p>
            </div>
          )}

          {/* Upcoming dates */}
          {siblingDates.length > 1 && (
            <div className="mt-6">
              <h3 className="font-heading text-sm font-bold uppercase tracking-wide mb-3">Upcoming dates</h3>
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
                      className={`inline-flex items-center px-3 py-1.5 text-xs font-mono font-bold transition-colors ${
                        isActive
                          ? 'bg-accent text-accent-foreground border-2 border-accent'
                          : 'border-2 border-border text-muted-foreground hover:border-foreground hover:text-foreground cursor-pointer'
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
