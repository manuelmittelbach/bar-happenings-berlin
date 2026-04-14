import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useMemo, useLayoutEffect } from "react";
import {
  MapPin, ExternalLink, ArrowLeft,
  ChevronDown, Plus
} from "lucide-react";
import ShareMenu from "@/components/events/ShareMenu";
import { motion } from "framer-motion";
import { formatDateWithDay, formatDateShort } from "@/lib/dateFormat";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { getEventById, getEventsByParent } from "@/data/mockData";

const languageLabel: Record<string, string> = {
  "EN": "in English",
  "DE": "in German",
  "EN/DE": "in English & German",
  "DE/EN": "in German & English",
  "EN/RU": "in English & Russian",
  "Multi": "multilingual",
};

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const event = getEventById(id || "");
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
        <h1 className="font-body text-2xl font-bold">Event not found</h1>
        <Link to="/" className="text-sm text-accent mt-2 inline-block">Back to home</Link>
      </div>
    );
  }

  const siblings = getEventsByParent(event.parentId);
  const siblingDates = siblings.map(e => e.date).filter((d, i, arr) => arr.indexOf(d) === i).sort();
const displayTitle = cleanEventTitle(event.title, event.venue);
  const hasRealImage = !!event.image;

  const priceLabel = event.price
    ? event.price.split(" — ")[0]
    : "Free entry";

  const handleMaps = () => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address || event.venue)}`, '_blank');
  };

  const handleSave = () => {
    const willBeSaved = !saved;
    setSaved(willBeSaved);
    setInterestedCount(prev => willBeSaved ? prev + 1 : prev - 1);

    if (willBeSaved) {
      const startDate = event.date.replace(/-/g, '');
      const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startDate}/${startDate}&location=${encodeURIComponent(event.address || event.venue)}&details=${encodeURIComponent(event.description.slice(0, 200))}`;
      window.open(calUrl, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Sticky back bar */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 px-4 py-3 text-muted-foreground hover:text-foreground text-sm font-medium tracking-wide transition-colors focus:outline-none"
        >
          <ArrowLeft className="h-4 w-4" />
          Events
        </button>
        <ShareMenu eventTitle={displayTitle} eventId={event.id} variant="header" />
      </div>

      {/* === ABOVE THE FOLD: Decision Zone === */}
      <div className="max-w-screen-md mx-auto">

        {/* Hero image — compact */}
        <div className="relative h-[180px] md:h-[260px] bg-muted overflow-hidden">
          {hasRealImage && (
            <img src={event.image!} alt={displayTitle} className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

        </div>

        {/* Core info block */}
        <div className="px-4 pt-4 pb-1">
<motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="font-body text-[22px] md:text-3xl font-extrabold leading-[1.1] tracking-tight"
          >
            {displayTitle}
          </motion.h1>


        </div>

        {/* Key details */}
        <div className="px-4 pt-3 pb-3 grid grid-cols-2 gap-4">
          {/* When */}
          <div>
            <p className="text-accent text-[11px] font-bold uppercase tracking-[0.12em] mb-1">When</p>
            <p className="font-body font-bold text-sm">{formatDateWithDay(event.date)}</p>
            {event.startTime && (
              <p className="text-foreground font-mono text-sm mt-0.5">
                {event.startTime}{event.endTime ? ` – ${event.endTime}` : ''}
              </p>
            )}
          </div>

          {/* Where */}
          <button onClick={handleMaps} className="text-left group">
            <p className="text-accent text-[11px] font-bold uppercase tracking-[0.12em] mb-1">Where</p>
            <div className="flex items-start justify-between gap-1">
              <p className="font-body font-bold text-sm group-hover:text-accent transition-colors">{event.venue}</p>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-accent shrink-0 mt-0.5 transition-colors" />
            </div>
            {event.address && (
              <p className="text-muted-foreground text-[11px] mt-0.5">{event.address}</p>
            )}
            <p className="text-muted-foreground text-[11px] mt-0.5 flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" /> {event.neighborhood}
            </p>
          </button>
        </div>

        {/* Info pills row */}
        <div className="px-4 pb-3">
          <p className="text-sm text-muted-foreground">
            {[priceLabel, event.recurrence || null, event.language ? (languageLabel[event.language] || event.language) : null].filter(Boolean).join(" · ")}
          </p>

        </div>


        {/* Interested row + secondary actions */}
        <div className="px-4 pb-4 space-y-3">
          {/* Interested count + button */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-baseline gap-2">
              <span className="font-body text-3xl font-extrabold text-accent">{interestedCount}</span>
              <span className="font-body text-sm font-bold text-accent uppercase tracking-wider">Interested</span>
            </div>
            <button
              onClick={handleSave}
              className={`h-12 px-6 flex items-center gap-2 text-sm font-bold uppercase tracking-wider font-body rounded-full border-2 transition-all duration-200 active:scale-[0.98] ${
                saved
                  ? "bg-accent text-accent-foreground border-accent shadow-[0_0_20px_hsl(var(--accent)/0.3)]"
                  : "bg-transparent text-foreground border-accent hover:bg-accent/10"
              }`}
            >
              {!saved && <Plus className="h-4 w-4" />}
              {saved ? "Interested ✓" : "Interested"}
            </button>
          </div>


        </div>

        <div className="border-t border-border mx-4" />

        {/* === BELOW THE FOLD: Details === */}

        {/* About — improved readability */}
        <div className="px-4 py-5 space-y-4">
          <h2 className="font-body text-sm font-bold uppercase tracking-[0.12em]">About this event</h2>
          {event.description.split("\n\n").map((p, i) => (
            <p key={i} className="text-sm text-muted-foreground/80 leading-[1.75] font-body">{p}</p>
          ))}
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
                <span className="font-medium">Upcoming events in this bar</span>
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
                        className={`inline-flex items-center px-3 py-1.5 text-[11px] font-mono font-bold transition-all active:scale-95 ${
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
              className="group w-full flex items-center justify-between py-3.5 border-b border-border text-sm text-foreground hover:text-accent transition-colors"
            >
              <span className="font-medium">Visit organizer</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
            </a>
          )}

        </div>

        {/* You might also like */}

        <div className="h-6" />
      </div>
    </div>
  );
}
