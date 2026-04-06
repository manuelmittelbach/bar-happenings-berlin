import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useMemo, useLayoutEffect } from "react";
import { MapPin, Globe, ExternalLink, RotateCw, ArrowLeft, Users, CalendarPlus, Share2, ChevronDown } from "lucide-react";
import ShareMenu from "@/components/events/ShareMenu";
import { motion } from "framer-motion";
import { formatDateWithDay, formatDateShort } from "@/lib/dateFormat";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { getEventById, getVenueById, getEventsByParent, getCategoryInfoByLabel } from "@/data/mockData";

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const event = getEventById(id || "");
  const [joined, setJoined] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);

  const baseCount = useMemo(() => {
    if (!id) return 0;
    const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return (hash % 42) + 1;
  }, [id]);

  const [interestedCount, setInterestedCount] = useState(baseCount);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [id]);

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <h1 className="font-heading text-2xl font-bold">Event not found</h1>
        <Link to="/" className="text-sm text-accent mt-2 inline-block">Back to home</Link>
      </div>
    );
  }

  const venue = getVenueById(event.venueId);
  const siblings = getEventsByParent(event.parentId);
  const siblingDates = siblings.map(e => e.date).filter((d, i, arr) => arr.indexOf(d) === i).sort();
  const catInfo = getCategoryInfoByLabel(event.category);
  const displayTitle = cleanEventTitle(event.title, event.venue);
  const hasRealImage = !!event.image;

  const handleJoin = () => {
    setJoined(!joined);
    setInterestedCount(prev => joined ? prev - 1 : prev + 1);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Sticky back button */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 px-4 py-3 text-muted-foreground hover:text-foreground text-sm font-medium tracking-wide transition-colors focus:outline-none"
        >
          <ArrowLeft className="h-4 w-4" />
          Events
        </button>
      </div>

      {/* Hero image */}
      <div className="relative h-[200px] bg-muted overflow-hidden">
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
        <div className="px-4 pb-4">
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

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="font-heading text-2xl font-extrabold leading-[1.1] tracking-tight mb-3"
          >
            {displayTitle}
          </motion.h1>

          <p className="text-accent font-heading font-bold text-base mb-1">
            {formatDateWithDay(event.date)}, {event.startTime}
          </p>
          <p className="text-foreground font-medium text-sm mb-2">{event.venue}</p>

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
        <div className="px-4 py-4 space-y-2.5">
          <h2 className="font-heading text-sm font-bold uppercase tracking-[0.12em]">About this event</h2>
          {event.description.split("\n\n").map((p, i) => (
            <p key={i} className="text-sm text-muted-foreground leading-relaxed">{p}</p>
          ))}
        </div>

        <div className="border-t border-border mx-4" />

        {/* Actions row */}
        <div className="px-4 py-4">
          <ShareMenu eventTitle={displayTitle} eventId={event.id} variant="full" />
        </div>

        <div className="border-t border-border mx-4" />

        {/* Venue card */}
        {event.address && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group mx-4 my-4 p-4 bg-card border-2 border-border hover:border-foreground transition-colors flex items-start justify-between gap-3 cursor-pointer block"
          >
            <div className="min-w-0">
              <h3 className="text-[10px] uppercase tracking-[0.15em] font-mono text-muted-foreground mb-1.5">Venue</h3>
              <p className="font-heading font-bold text-sm">{event.venue}</p>
              <p className="text-xs text-muted-foreground mt-1">{event.address}</p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-accent shrink-0 mt-5 transition-colors" />
          </a>
        )}

        <div className="border-t border-border mx-4" />

        {/* Utility rows */}
        <div className="px-4">
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
                          if (!isActive && siblingEvent) {
                            navigate(`/event/${siblingEvent.id}`);
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

        <div className="h-6" />
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t-2 border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-screen-md mx-auto">
          {event.price ? (
            <div className="min-w-0">
              {(() => {
                const parts = event.price.split(" — ");
                const mainPrice = parts[0];
                const extra = parts[1];
                return (
                  <>
                    <p className="text-sm font-heading font-bold text-foreground">{mainPrice}</p>
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
  );
}
