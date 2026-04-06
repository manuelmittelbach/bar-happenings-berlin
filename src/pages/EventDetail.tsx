import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useMemo, useLayoutEffect } from "react";
import {
  MapPin, Globe, ExternalLink, RotateCw, ArrowLeft, Users,
  CalendarPlus, Share2, ChevronDown, Bookmark, BookmarkCheck, Navigation, Clock
} from "lucide-react";
import ShareMenu from "@/components/events/ShareMenu";
import { motion } from "framer-motion";
import { formatDateWithDay, formatDateShort } from "@/lib/dateFormat";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { getEventById, getVenueById, getEventsByParent, getCategoryInfoByLabel } from "@/data/mockData";
import { getEventBadge } from "@/lib/eventBadges";

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const event = getEventById(id || "");
  const [joined, setJoined] = useState(false);
  const [saved, setSaved] = useState(false);
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
    const raf = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    return () => cancelAnimationFrame(raf);
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
  const badge = getEventBadge(event, interestedCount);

  const priceLabel = event.price
    ? event.price.split(" — ")[0]
    : "Free entry";

  const hookLine = event.summary || event.description.split("\n\n")[0].slice(0, 100) + (event.description.split("\n\n")[0].length > 100 ? "…" : "");

  const handleJoin = () => {
    setJoined(!joined);
    setInterestedCount(prev => joined ? prev - 1 : prev + 1);
  };

  const handleCalendar = () => {
    const startDate = event.date.replace(/-/g, '');
    const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startDate}/${startDate}&location=${encodeURIComponent(event.address || event.venue)}&details=${encodeURIComponent(event.description.slice(0, 200))}`;
    window.open(calUrl, '_blank');
  };

  const handleMaps = () => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address || event.venue)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Sticky back bar */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 px-4 py-3 text-muted-foreground hover:text-foreground text-sm font-medium tracking-wide transition-colors focus:outline-none"
        >
          <ArrowLeft className="h-4 w-4" />
          Events
        </button>
      </div>

      {/* === ABOVE THE FOLD: Decision Zone === */}
      <div className="max-w-screen-md mx-auto">

        {/* Hero image — compact */}
        <div className="relative h-[180px] md:h-[260px] bg-muted overflow-hidden">
          {hasRealImage ? (
            <img src={event.image!} alt={displayTitle} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-muted-foreground/20 font-mono text-xs uppercase tracking-widest">No image</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

          {/* Floating badges on image */}
          <div className="absolute bottom-3 left-4 flex items-center gap-2">
            {catInfo && (
              <span className="inline-flex items-center px-2.5 py-1 bg-background/90 backdrop-blur-sm text-accent text-[11px] font-bold uppercase tracking-wider border border-accent/30">
                {catInfo.emoji} {catInfo.label}
              </span>
            )}
            {badge && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 backdrop-blur-sm text-[11px] font-bold uppercase tracking-wider border ${
                badge.variant === 'live'
                  ? 'bg-[hsl(0,72%,51%)]/90 text-white border-[hsl(0,72%,51%)]'
                  : badge.variant === 'soon'
                    ? 'bg-[hsl(42,100%,50%)]/90 text-black border-[hsl(42,100%,50%)]'
                    : 'bg-accent/90 text-accent-foreground border-accent'
              }`}>
                <badge.icon className="h-3 w-3" />
                {badge.label}
              </span>
            )}
          </div>
        </div>

        {/* Core info block */}
        <div className="px-4 pt-4 pb-3">
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="font-heading text-[22px] md:text-3xl font-extrabold leading-[1.1] tracking-tight"
          >
            {displayTitle}
          </motion.h1>

          <p className="text-muted-foreground text-sm mt-2 leading-snug line-clamp-2">
            {hookLine}
          </p>
        </div>

        {/* Key details grid — scannable */}
        <div className="px-4 pb-3">
          <div className="grid grid-cols-2 gap-2">
            {/* When */}
            <div className="bg-card border-2 border-border p-3">
              <p className="text-[10px] uppercase tracking-[0.15em] font-mono text-muted-foreground mb-1">When</p>
              <p className="font-heading font-bold text-sm">{formatDateWithDay(event.date)}</p>
              {event.startTime && (
                <p className="text-accent font-mono font-bold text-sm mt-0.5">
                  {event.startTime}{event.endTime ? ` – ${event.endTime}` : ''}
                </p>
              )}
            </div>

            {/* Where */}
            <button
              onClick={handleMaps}
              className="bg-card border-2 border-border p-3 text-left hover:border-accent/50 transition-colors group"
            >
              <p className="text-[10px] uppercase tracking-[0.15em] font-mono text-muted-foreground mb-1">Where</p>
              <p className="font-heading font-bold text-sm group-hover:text-accent transition-colors">{event.venue}</p>
              <p className="text-muted-foreground text-[11px] mt-0.5 flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" /> {event.neighborhood}
              </p>
            </button>
          </div>
        </div>

        {/* Info pills row */}
        <div className="px-4 pb-4 flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center px-3 py-1.5 bg-accent/15 text-accent text-[12px] font-heading font-bold border border-accent/30">
            {priceLabel}
          </span>
          {event.recurrence && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-muted text-muted-foreground text-[11px] font-mono border border-border">
              <RotateCw className="h-3 w-3" /> {event.recurrence}
            </span>
          )}
          {event.language && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-muted text-muted-foreground text-[11px] font-medium border border-border">
              <Globe className="h-3 w-3" /> {event.language}
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-muted text-muted-foreground text-[11px] font-medium border border-border">
            <Users className="h-3 w-3 text-accent" />
            <strong className="text-foreground">{interestedCount}</strong> interested
          </span>
        </div>

        {/* Primary CTA + secondary actions */}
        <div className="px-4 pb-4 space-y-3">
          {/* Primary CTA */}
          <button
            onClick={handleJoin}
            className={`w-full h-14 text-sm font-bold uppercase tracking-wider font-heading transition-all duration-200 ${
              joined
                ? "bg-accent text-accent-foreground border-2 border-accent"
                : "bg-[hsl(var(--accent))] text-accent-foreground border-2 border-accent hover:shadow-[0_0_24px_hsl(18_85%_52%/0.4)]"
            }`}
          >
            {joined ? "✓ I'm interested" : "I want to join"}
          </button>

          {/* Secondary actions row */}
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => setSaved(!saved)}
              className={`flex flex-col items-center gap-1.5 py-3 border-2 transition-all text-[10px] font-heading font-bold uppercase tracking-wider ${
                saved
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
              }`}
            >
              {saved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
              Save
            </button>

            <ShareMenu eventTitle={displayTitle} eventId={event.id} variant="icon" />

            <button
              onClick={handleCalendar}
              className="flex flex-col items-center gap-1.5 py-3 border-2 border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-all text-[10px] font-heading font-bold uppercase tracking-wider"
            >
              <CalendarPlus className="h-5 w-5" />
              Calendar
            </button>

            <button
              onClick={handleMaps}
              className="flex flex-col items-center gap-1.5 py-3 border-2 border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-all text-[10px] font-heading font-bold uppercase tracking-wider"
            >
              <Navigation className="h-5 w-5" />
              Maps
            </button>
          </div>
        </div>

        <div className="border-t border-border mx-4" />

        {/* === BELOW THE FOLD: Details === */}

        {/* About */}
        <div className="px-4 py-5 space-y-2.5">
          <h2 className="font-heading text-sm font-bold uppercase tracking-[0.12em]">About this event</h2>
          {event.description.split("\n\n").map((p, i) => (
            <p key={i} className="text-sm text-muted-foreground leading-relaxed">{p}</p>
          ))}
        </div>

        <div className="border-t border-border mx-4" />

        {/* Practical info */}
        <div className="px-4 py-5 space-y-3">
          <h2 className="font-heading text-sm font-bold uppercase tracking-[0.12em]">Practical info</h2>
          {event.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-3 py-2 text-sm hover:text-accent transition-colors"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">{event.address}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{event.neighborhood}</p>
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-accent shrink-0 transition-colors" />
            </a>
          )}
          {event.startTime && (
            <div className="flex items-center gap-2.5 py-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>Doors at <strong>{event.startTime}</strong>{event.endTime ? ` · Ends ${event.endTime}` : ''}</span>
            </div>
          )}
          {event.price && (
            <div className="flex items-center gap-2.5 py-2 text-sm">
              <span className="h-4 w-4 text-muted-foreground shrink-0 text-center text-xs font-bold">€</span>
              <span>{event.price}</span>
            </div>
          )}
        </div>

        <div className="border-t border-border mx-4" />

        {/* Utility rows */}
        <div className="px-4">
          {/* Upcoming dates */}
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
    </div>
  );
}
