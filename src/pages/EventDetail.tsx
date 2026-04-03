import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { MapPin, Clock, Calendar, Share2, ArrowLeft, Users, Globe, Tag } from "lucide-react";
import { motion } from "framer-motion";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import VenueBlock from "@/components/events/VenueBlock";
import { getEventById, getVenueById, getEventsByVenue } from "@/data/mockData";

export default function EventDetail() {
  const { id } = useParams();
  const event = getEventById(id || "");
  const [joined, setJoined] = useState(false);
  const [interestedCount, setInterestedCount] = useState(event?.interestedCount || 0);

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="heading-display text-2xl">Event not found</h1>
            <Link to="/" className="text-sm text-accent mt-2 inline-block">Back to home</Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const venue = getVenueById(event.venueId);
  const otherEvents = getEventsByVenue(event.venueId).filter(e => e.id !== event.id);

  const handleJoin = () => {
    setJoined(!joined);
    setInterestedCount(prev => joined ? prev - 1 : prev + 1);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero image */}
        <div className="relative h-[40vh] md:h-[50vh] bg-muted overflow-hidden">
          <img
            src={event.image}
            alt={event.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
          <div className="absolute top-4 left-4">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-sm bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-sm hover:bg-background transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </div>
        </div>

        <div className="container -mt-20 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex flex-wrap gap-2 mb-3">
              {event.tags.map(tag => (
                <span key={tag} className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-muted border border-border rounded-sm">
                  {tag}
                </span>
              ))}
            </div>
            <h1 className="heading-display text-3xl md:text-5xl">{event.title}</h1>
            <p className="text-lg text-muted-foreground mt-2 font-medium">{event.venue}</p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mt-8 pb-16">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Details grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 border border-border rounded-sm">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Date</span>
                  <p className="text-sm font-medium">{formatDateWithDay(event.date)}</p>
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

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {event.address}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" /> {event.language}</p>
              </div>

              {/* Description */}
              <div className="space-y-4">
                <h2 className="font-heading text-lg font-semibold">About this event</h2>
                {event.description.split("\n\n").map((p, i) => (
                  <p key={i} className="text-sm text-muted-foreground leading-relaxed">{p}</p>
                ))}
              </div>

            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <div className="sticky top-20 space-y-4">
                <button
                  onClick={handleJoin}
                  className={`w-full h-12 rounded-sm text-sm font-semibold transition-all ${
                    joined
                      ? "bg-accent text-accent-foreground"
                      : "bg-foreground text-background hover:bg-foreground/90"
                  }`}
                >
                  {joined ? "✓ I'm interested" : "I want to join"}
                </button>
                <p className="text-center text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <Users className="h-4 w-4" /> {interestedCount} people interested
                </p>

                <button className="w-full h-10 rounded-sm border border-border text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2">
                  <Share2 className="h-4 w-4" /> Share event
                </button>

                
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
