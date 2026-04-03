import { useState } from "react";
import { MapPin, Clock, Calendar, Share2, Users, Globe, Tag, X } from "lucide-react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import QuestionThread from "@/components/events/QuestionThread";
import VenueBlock from "@/components/events/VenueBlock";
import { getEventById, getVenueById, getEventsByVenue, questions } from "@/data/mockData";

interface EventDetailDialogProps {
  eventId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EventDetailDialog({ eventId, open, onOpenChange }: EventDetailDialogProps) {
  const event = eventId ? getEventById(eventId) : null;
  const [joined, setJoined] = useState(false);
  const [interestedCount, setInterestedCount] = useState(0);

  // Reset state when event changes
  const venue = event ? getVenueById(event.venueId) : null;
  const otherEvents = event ? getEventsByVenue(event.venueId).filter(e => e.id !== event.id) : [];

  if (!event) return null;

  const handleJoin = () => {
    setJoined(!joined);
    setInterestedCount(prev => joined ? prev - 1 : prev + 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 border-2 border-foreground gap-0">
        <DialogTitle className="sr-only">{event.title}</DialogTitle>
        {/* Hero image */}
        <div className="relative h-[240px] md:h-[300px] bg-muted overflow-hidden">
          <img
            src={event.image}
            alt={event.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
        </div>

        <div className="px-6 -mt-16 relative z-10 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex flex-wrap gap-2 mb-2">
              {event.tags.map(tag => (
                <span key={tag} className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-muted border border-border">
                  {tag}
                </span>
              ))}
            </div>
            <h2 className="heading-display text-2xl md:text-4xl">{event.title}</h2>
            <p className="text-base text-muted-foreground mt-1 font-medium">{event.venue}</p>
          </motion.div>

          {/* Details grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-2 border-border mt-6">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Date</span>
              <p className="text-sm font-medium">{event.date}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Time</span>
              <p className="text-sm font-medium">{event.startTime} – {event.endTime}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Location</span>
              <p className="text-sm font-medium">{event.neighborhood}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3" /> Entry</span>
              <p className="text-sm font-medium">{event.entryInfo}</p>
            </div>
          </div>

          <div className="space-y-1 mt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {event.address}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" /> {event.language}</p>
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
            <button className="h-11 px-4 border-2 border-border text-sm hover:bg-muted transition-colors flex items-center gap-2">
              <Share2 className="h-4 w-4" />
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
            <Users className="h-3 w-3" /> {interestedCount || event.interestedCount} interested
          </p>

          {/* Description */}
          <div className="mt-8 space-y-3">
            <h3 className="font-heading text-base font-bold uppercase">About this event</h3>
            {event.description.split("\n\n").map((p, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">{p}</p>
            ))}
          </div>

          {/* Venue */}
          {venue && (
            <div className="mt-8">
              <VenueBlock venue={venue} otherEvents={otherEvents} />
            </div>
          )}

          {/* Q&A */}
          <div className="mt-8">
            <QuestionThread questions={questions} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
