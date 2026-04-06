import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useMemo } from "react";
import { MapPin, Globe, ExternalLink, RotateCw, ArrowLeft, Users } from "lucide-react";
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

  const baseCount = useMemo(() => {
    if (!id) return 0;
    const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return (hash % 42) + 1;
  }, [id]);

  const [interestedCount, setInterestedCount] = useState(baseCount);

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
    <div className="min-h-screen bg-background">
      {/* Back button */}
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-1.5 px-4 pt-10 pb-1 text-muted-foreground hover:text-foreground text-sm font-medium tracking-wide transition-colors focus:outline-none"
      >
        <ArrowLeft className="h-4 w-4" />
        Events
      </button>

      {/* Hero image — always visible, placeholder when no image */}
      <div className="relative h-[180px] bg-muted overflow-hidden">
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
        <div className="px-4 pb-5">
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
            className="font-heading text-2xl font-extrabold leading-[1.1] tracking-tight mb-4"
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

        {/* Price + CTA */}
        <div className="mx-4 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-card border-2 border-border">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.15em] font-mono text-muted-foreground mb-0.5">Entry</p>
              <p className="text-base font-heading font-bold">{event.price}</p>
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

        {/* Actions */}
        <div className="flex items-center gap-2 px-4 mb-5">
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
          <div className="flex-1">
            <ShareMenu eventTitle={displayTitle} eventId={event.id} variant="full" />
          </div>
        </div>

        <div className="border-t-2 border-border mx-4" />

        {/* About */}
        <div className="px-4 py-5 space-y-2.5">
          <h2 className="font-heading text-sm font-bold uppercase tracking-[0.12em]">About this event</h2>
          {event.description.split("\n\n").map((p, i) => (
            <p key={i} className="text-sm text-muted-foreground leading-relaxed">{p}</p>
          ))}
        </div>

        {/* Venue card */}
        {event.address && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group mx-4 mb-5 p-4 bg-card border-2 border-border hover:border-foreground transition-colors flex items-start justify-between gap-3 cursor-pointer"
          >
            <div className="min-w-0">
              <h3 className="text-[10px] uppercase tracking-[0.15em] font-mono text-muted-foreground mb-1.5">Venue</h3>
              <p className="font-heading font-bold text-sm">{event.venue}</p>
              <p className="text-xs text-muted-foreground mt-1">{event.address}</p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-accent shrink-0 mt-5 transition-colors" />
          </a>
        )}

        {/* Upcoming dates */}
        {siblingDates.length > 1 && (
          <div className="px-4 pb-6">
            <h3 className="font-heading text-sm font-bold uppercase tracking-[0.12em] mb-3">Upcoming dates</h3>
            <div className="flex flex-wrap gap-2">
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
          </div>
        )}
      </div>
    </div>
  );
}
