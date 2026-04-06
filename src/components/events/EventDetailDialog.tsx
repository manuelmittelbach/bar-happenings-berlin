import { useState, useEffect, useMemo, useRef } from "react";
import { MapPin, Globe, ExternalLink, RotateCw, ArrowLeft, Users, CalendarPlus, CalendarDays, ChevronDown } from "lucide-react";
import ShareMenu from "@/components/events/ShareMenu";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatDateWithDay, formatDateShort } from "@/lib/dateFormat";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { getEventById, getVenueById, getEventsByParent, getCategoryInfoByLabel } from "@/data/mockData";
import { getEventBadge, type EventBadge } from "@/lib/eventBadges";

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
  const [datesOpen, setDatesOpen] = useState(false);

  const baseCount = useMemo(() => {
    if (!eventId) return 0;
    const hash = eventId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return (hash % 42) + 1;
  }, [eventId]);

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setJoined(false);
    setInterestedCount(baseCount);
    // Scroll dialog content to top when switching events — use multiple frames to ensure DOM is ready
    const raf = requestAnimationFrame(() => {
      contentRef.current?.scrollTo({ top: 0 });
      // Double-ensure after layout settles (mobile Safari)
      setTimeout(() => {
        contentRef.current?.scrollTo({ top: 0 });
      }, 50);
    });
    return () => cancelAnimationFrame(raf);
  }, [eventId, baseCount]);

  const venue = event ? getVenueById(event.venueId) : null;
  const siblings = event ? getEventsByParent(event.parentId) : [];
  const siblingDates = siblings.map(e => e.date).filter((d, i, arr) => arr.indexOf(d) === i).sort();
  const catInfo = event ? getCategoryInfoByLabel(event.category) : null;
  const badge = useMemo(() => event ? getEventBadge(event, interestedCount) : null, [event, interestedCount]);

  const badgeVariantClasses: Record<EventBadge["variant"], string> = {
    live: "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-[0_0_12px_hsl(0_72%_51%/0.5)]",
    soon: "bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-foreground shadow-[0_0_10px_hsl(var(--primary)/0.4)]",
    popular: "bg-gradient-to-r from-[hsl(var(--accent))] to-pink-500 text-white shadow-[0_0_10px_hsl(var(--accent)/0.4)]",
  };

  if (!event) return null;

  const displayTitle = cleanEventTitle(event.title, event.venue);
  const hasRealImage = !!event.image;

  const handleJoin = () => {
    setJoined(!joined);
    setInterestedCount(prev => joined ? prev - 1 : prev + 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={contentRef} className="max-w-2xl md:max-h-[92vh] p-0 md:border-2 md:border-foreground gap-0 overflow-y-auto bg-background" fullscreenMobile onOpenAutoFocus={(e) => { e.preventDefault(); contentRef.current?.scrollTo({ top: 0 }); }}>
        <DialogTitle className="sr-only">{displayTitle}</DialogTitle>

        {/* Mobile back */}
        <button
          onClick={() => onOpenChange(false)}
          className="md:hidden flex items-center gap-1.5 px-4 pt-10 pb-1 text-muted-foreground hover:text-foreground text-sm font-medium tracking-wide transition-colors focus:outline-none focus-visible:outline-none"
        >
          <ArrowLeft className="h-4 w-4" />
          Events
        </button>

        {/* Hero image */}
        <div className={`relative ${hasRealImage ? 'h-[200px] md:h-[260px]' : 'h-[120px] md:h-[160px]'} bg-muted overflow-hidden`}>
          {hasRealImage ? (
            <img src={event.image!} alt={displayTitle} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-muted-foreground/20 font-mono text-xs uppercase tracking-widest">No image</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>

        {/* Content */}
        <div className="-mt-8 relative z-10">

          {/* Header */}
          <div className="px-4 md:px-8 pb-4">
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
              {badge && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[12px] font-heading font-bold uppercase tracking-wide -rotate-1 ${badgeVariantClasses[badge.variant]} ${badge.variant === "live" ? "animate-pulse" : ""}`}>
                  <badge.icon className="h-3.5 w-3.5" />
                  {badge.label}
                </span>
              )}
            </div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="font-body text-2xl md:text-[2.5rem] font-extrabold leading-[1.1] tracking-tight mb-3"
            >
              {displayTitle}
            </motion.h2>

            <p className="text-accent font-body font-bold text-base md:text-lg mb-1">
              {formatDateWithDay(event.date)}, {event.startTime}
            </p>
            <p className="text-foreground font-medium text-sm md:text-base mb-2">{event.venue}</p>

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

          {/* About — directly after header */}
          <div className="px-4 md:px-8 py-4 space-y-2.5">
            <h3 className="font-heading text-sm font-bold uppercase tracking-[0.12em]">About this event</h3>
            {event.description.split("\n\n").map((p, i) => (
              <p key={i} className="text-sm md:text-[15px] text-muted-foreground leading-relaxed">{p}</p>
            ))}
          </div>

          <div className="border-t border-border mx-4 md:mx-8" />

          {/* Share button */}
          <div className="px-4 md:px-8 py-4">
            <ShareMenu eventTitle={displayTitle} eventId={event.id} variant="full" />
          </div>

          <div className="border-t border-border mx-4 md:mx-8" />

          {/* Venue card */}
          {event.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group mx-4 md:mx-8 my-4 p-4 bg-card border-2 border-border hover:border-foreground transition-colors flex items-start justify-between gap-3 cursor-pointer block"
            >
              <div className="min-w-0">
                <h3 className="text-[10px] uppercase tracking-[0.15em] font-mono text-muted-foreground mb-1.5">Venue</h3>
                <p className="font-body font-bold text-sm md:text-base">{event.venue}</p>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">{event.address}</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-accent shrink-0 mt-5 transition-colors" />
            </a>
          )}

          <div className="border-t border-border mx-4 md:mx-8" />

          {/* Utility rows */}
          <div className="px-4 md:px-8">
            {/* Upcoming dates collapsible */}
            {siblingDates.length > 1 && (
              <div className="border-b border-border">
                <button
                  className="w-full flex items-center justify-between py-3.5 text-sm text-foreground hover:text-accent transition-colors"
                  onClick={() => setDatesOpen(!datesOpen)}
                >
                  <span className="font-medium">Upcoming dates</span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${datesOpen ? 'rotate-180' : ''}`} />
                </button>
                {datesOpen && (
                  <div className="flex flex-wrap gap-2 pb-3.5">
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
                )}
              </div>
            )}

            <button
              className="w-full flex items-center justify-between py-3.5 border-b border-border text-sm text-foreground hover:text-accent transition-colors"
              onClick={() => {
                const startDate = event.date.replace(/-/g, '');
                const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startDate}/${startDate}&location=${encodeURIComponent(event.address || event.venue)}&details=${encodeURIComponent(event.description.slice(0, 200))}`;
                window.open(calUrl, '_blank');
              }}
            >
              <span className="font-medium">Add to calendar</span>
              <CalendarPlus className="h-4 w-4 text-muted-foreground" />
            </button>

            {event.url && (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between py-3.5 border-b border-border text-sm text-foreground hover:text-accent transition-colors"
              >
                <span className="font-medium">Visit organizer</span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
            )}
          </div>

          {/* Sticky bottom bar */}
          <div className="sticky bottom-0 z-50 bg-background/95 backdrop-blur-sm border-t-2 border-border mt-6">
            <div className="flex items-center justify-between px-4 md:px-8 py-3">
              {event.price ? (
                <div className="min-w-0">
                  {(() => {
                    const parts = event.price.split(" — ");
                    const mainPrice = parts[0];
                    const extra = parts[1];
                    return (
                      <>
                        <p className="text-sm font-body font-bold text-foreground">{mainPrice}</p>
                        {extra && <p className="text-[10px] text-muted-foreground truncate">{extra}</p>}
                      </>
                    );
                  })()}
                </div>
              ) : <div />}
              <button
                onClick={handleJoin}
                className={`shrink-0 px-6 h-12 text-sm font-bold uppercase tracking-wider font-heading transition-all ${
                  joined
                    ? "bg-accent text-accent-foreground"
                    : "bg-[hsl(25,95%,53%)] text-white hover:bg-[hsl(25,95%,45%)]"
                }`}
              >
                {joined ? "✓ Interested" : "I want to join"}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
