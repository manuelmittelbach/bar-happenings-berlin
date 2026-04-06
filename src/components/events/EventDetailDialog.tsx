import { useState, useEffect, useMemo } from "react";
import { MapPin, Clock, Calendar, Globe, ExternalLink, RotateCw, Navigation, ArrowLeft, Users, X } from "lucide-react";
import ShareMenu from "@/components/events/ShareMenu";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatDateWithDay, formatDateShort } from "@/lib/dateFormat";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { getEventById, getVenueById, getEventsByParent, getCategoryInfoByLabel } from "@/data/mockData";

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

  const displayTitle = cleanEventTitle(event.title, event.venue);
  const hasRealImage = !!event.image;

  const handleJoin = () => {
    setJoined(!joined);
    setInterestedCount(prev => joined ? prev - 1 : prev + 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl md:max-h-[92vh] p-0 md:border-2 md:border-foreground gap-0 overflow-y-auto bg-background" fullscreenMobile>
        <DialogTitle className="sr-only">{displayTitle}</DialogTitle>

        {/* Mobile back */}
        <button
          onClick={() => onOpenChange(false)}
          className="md:hidden flex items-center gap-1.5 px-4 pt-14 pb-2 text-muted-foreground hover:text-foreground text-xs font-medium tracking-wide transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Events
        </button>

        {/* Hero image - only real images */}
        {hasRealImage && (
          <div className="relative h-[200px] md:h-[260px] bg-muted overflow-hidden">
            <img src={event.image!} alt={displayTitle} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
          </div>
        )}

        {/* Content */}
        <div className={`${hasRealImage ? '-mt-10' : 'pt-16 md:pt-10'} relative z-10`}>

          {/* ── HEADER SECTION ── */}
          <div className="px-4 md:px-8 pb-5">
            {/* Category pill + recurrence — no emoji */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {catInfo && (
                <span className="inline-flex items-center px-2.5 py-1 bg-accent/15 text-accent text-[11px] font-bold uppercase tracking-wider">
                  {catInfo.label}
                </span>
              )}
              {event.recurrence && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-muted text-muted-foreground text-[11px] font-mono">
                  <RotateCw className="h-3 w-3" /> {event.recurrence}
                </span>
              )}
            </div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="font-heading text-2xl md:text-[2.5rem] font-extrabold leading-[1.1] tracking-tight mb-4"
            >
              {displayTitle}
            </motion.h2>

            {/* Date — accent color */}
            <p className="text-accent font-heading font-bold text-base md:text-lg mb-1">
              {formatDateWithDay(event.date)}, {event.startTime}
            </p>

            {/* Venue name */}
            <p className="text-foreground font-medium text-sm md:text-base mb-2">{event.venue}</p>

            {/* Info pills row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {event.neighborhood && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted text-muted-foreground text-[11px] font-medium">
                  <MapPin className="h-3 w-3 shrink-0" /> {event.neighborhood}
                </span>
              )}
              {event.language && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted text-muted-foreground text-[11px] font-medium">
                  <Globe className="h-3 w-3 shrink-0" /> {event.language}
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted text-muted-foreground text-[11px] font-medium">
                <Users className="h-3 w-3 text-accent shrink-0" />
                <strong className="text-foreground">{interestedCount}</strong> interested
              </span>
            </div>
          </div>

          {/* ── PRICE + CTA BAR ── */}
          <div className="mx-4 md:mx-8 mb-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-card border-2 border-border">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.15em] font-mono text-muted-foreground mb-0.5">Entry</p>
                <p className="text-base md:text-lg font-heading font-bold">{event.price}</p>
              </div>
              <button
                onClick={handleJoin}
                className={`w-full sm:w-auto shrink-0 px-6 h-11 text-xs font-bold uppercase tracking-wider font-heading transition-all ${
                  joined
                    ? "bg-accent text-accent-foreground border-2 border-accent"
                    : "bg-foreground text-background border-2 border-foreground hover:bg-background hover:text-foreground"
                }`}
              >
                {joined ? "✓ Interested" : "I want to join"}
              </button>
            </div>
          </div>

          {/* ── ACTIONS ROW ── */}
          <div className="flex items-center gap-2 px-4 md:px-8 mb-5 overflow-x-auto">
            {event.url && (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-mono font-bold uppercase tracking-wider border-2 border-border hover:border-foreground hover:bg-muted transition-colors whitespace-nowrap shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Website
              </a>
            )}
            {event.address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-mono font-bold uppercase tracking-wider border-2 border-border hover:border-foreground hover:bg-muted transition-colors whitespace-nowrap shrink-0"
              >
                <Navigation className="h-3.5 w-3.5" /> Directions
              </a>
            )}
            <div className="ml-auto shrink-0">
              <ShareMenu eventTitle={displayTitle} eventId={event.id} />
            </div>
          </div>

          {/* ── DIVIDER ── */}
          <div className="border-t-2 border-border mx-4 md:mx-8" />

          {/* ── ABOUT ── */}
          <div className="px-4 md:px-8 py-5 space-y-2.5">
            <h3 className="font-heading text-sm font-bold uppercase tracking-[0.12em]">About this event</h3>
            {event.description.split("\n\n").map((p, i) => (
              <p key={i} className="text-sm md:text-[15px] text-muted-foreground leading-relaxed">{p}</p>
            ))}
          </div>

          {/* ── VENUE CARD ── */}
          {event.address && (
            <div className="mx-4 md:mx-8 mb-5 p-4 bg-card border-2 border-border">
              <h3 className="text-[10px] uppercase tracking-[0.15em] font-mono text-muted-foreground mb-1.5">Venue</h3>
              <p className="font-heading font-bold text-sm md:text-base">{event.venue}</p>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">{event.address}</p>
            </div>
          )}

          {/* ── UPCOMING DATES ── */}
          {siblingDates.length > 1 && (
            <div className="px-4 md:px-8 pb-6">
              <h3 className="font-heading text-sm font-bold uppercase tracking-[0.12em] mb-3">Upcoming dates</h3>
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
                      className={`inline-flex items-center px-3 py-1.5 text-[11px] font-mono font-bold transition-colors ${
                        isActive
                          ? 'bg-accent text-accent-foreground'
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
