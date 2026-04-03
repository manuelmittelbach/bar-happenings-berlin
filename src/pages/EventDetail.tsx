import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, Users, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import QuestionThread from "@/components/events/QuestionThread";
import { getEventById, getVenueById, getEventsByVenue, questions } from "@/data/mockData";

export default function EventDetail() {
  const { id } = useParams();
  const event = getEventById(id || "");
  const [joined, setJoined] = useState(false);
  const [interestedCount, setInterestedCount] = useState(event?.interestedCount || 0);

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col bg-[hsl(0,0%,6%)]">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="heading-display text-2xl text-[hsl(40,20%,93%)]">Event not found</h1>
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

  // Format date nicely
  const dateObj = new Date(event.date);
  const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });
  const formattedDate = dateObj.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(0,0%,6%)] text-[hsl(40,20%,93%)]">
      <Header />
      <main className="flex-1">
        {/* Back link */}
        <div className="container pt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-[hsl(40,20%,50%)] hover:text-[hsl(40,20%,93%)] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </div>

        {/* Hero image — full width, raw */}
        <div className="container mt-6">
          <div className="relative w-full max-w-4xl mx-auto">
            <img
              src={event.image}
              alt={event.title}
              className="w-full h-auto max-h-[50vh] object-cover grayscale hover:grayscale-0 transition-all duration-700"
            />
          </div>
        </div>

        {/* Content layout — sidebar left + main right, like RA / Berghain */}
        <div className="container mt-10 pb-20">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 max-w-5xl mx-auto">
            
            {/* Left sidebar — metadata */}
            <motion.aside
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="lg:w-[200px] shrink-0 space-y-8"
            >
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[hsl(40,20%,40%)] mb-1">Location</p>
                <p className="text-sm leading-snug">{venue?.address || event.address}</p>
                <p className="text-sm leading-snug">{event.neighborhood}</p>
              </div>

              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[hsl(40,20%,40%)] mb-1">Entry</p>
                <p className="text-sm">{event.entryInfo}</p>
              </div>

              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[hsl(40,20%,40%)] mb-1">Language</p>
                <p className="text-sm">{event.language}</p>
              </div>

              {venue?.instagram && (
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[hsl(40,20%,40%)] mb-1">Instagram</p>
                  <p className="text-sm text-accent">{venue.instagram}</p>
                </div>
              )}

              {/* Join CTA */}
              <div className="space-y-3 pt-4 border-t border-[hsl(40,20%,20%)]">
                <button
                  onClick={handleJoin}
                  className={`w-full h-11 text-xs font-mono uppercase tracking-widest transition-all border-2 ${
                    joined
                      ? "bg-accent border-accent text-white"
                      : "bg-transparent border-[hsl(40,20%,93%)] text-[hsl(40,20%,93%)] hover:bg-[hsl(40,20%,93%)] hover:text-[hsl(0,0%,6%)]"
                  }`}
                >
                  {joined ? "✓ Interested" : "I want to join"}
                </button>
                <p className="text-[10px] font-mono text-[hsl(40,20%,40%)] flex items-center gap-1.5">
                  <Users className="h-3 w-3" /> {interestedCount} interested
                </p>
                <button className="w-full h-9 text-[10px] font-mono uppercase tracking-widest border border-[hsl(40,20%,20%)] text-[hsl(40,20%,50%)] hover:text-[hsl(40,20%,93%)] hover:border-[hsl(40,20%,50%)] transition-colors flex items-center justify-center gap-1.5">
                  <Share2 className="h-3 w-3" /> Share
                </button>
              </div>

              {/* Other events at venue */}
              {otherEvents.length > 0 && (
                <div className="pt-4 border-t border-[hsl(40,20%,20%)]">
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[hsl(40,20%,40%)] mb-3">Also at {venue?.name}</p>
                  <div className="space-y-2">
                    {otherEvents.slice(0, 3).map(ev => (
                      <Link
                        key={ev.id}
                        to={`/event/${ev.id}`}
                        className="block text-sm text-[hsl(40,20%,60%)] hover:text-accent transition-colors leading-snug"
                      >
                        {ev.title}
                        <span className="block text-[10px] font-mono text-[hsl(40,20%,35%)] mt-0.5">
                          {ev.date} · {ev.startTime}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </motion.aside>

            {/* Main content — right side */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex-1 min-w-0"
            >
              {/* Date line */}
              <p className="text-sm font-mono text-[hsl(40,20%,50%)]">
                {dayName} <span className="font-bold text-[hsl(40,20%,93%)]">{formattedDate}</span> start {event.startTime}
              </p>

              {/* Event title — large, accent colored */}
              <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-extrabold uppercase tracking-tight text-accent mt-3 leading-[0.95]">
                {event.title}
              </h1>

              {/* Venue name — accent link */}
              <p className="text-accent text-sm mt-2 font-mono">{event.venue}</p>

              {/* Tags as subtle text */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-6">
                {event.tags.map(tag => (
                  <span key={tag} className="text-xs font-mono uppercase tracking-wider text-[hsl(40,20%,40%)]">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Category / lineup style display */}
              <div className="mt-8 pl-4 border-l-2 border-[hsl(40,20%,25%)]">
                <p className="font-heading text-xl md:text-2xl font-bold uppercase tracking-tight">
                  {event.category}
                </p>
                <p className="text-sm text-[hsl(40,20%,50%)] mt-1 font-mono">{event.neighborhood}</p>
              </div>

              {/* Entry info block */}
              <div className="mt-8">
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[hsl(40,20%,40%)] mb-1">Entry</p>
                <p className="text-sm font-bold">{event.entryInfo}</p>
              </div>

              {/* Description — raw editorial text */}
              <div className="mt-10 space-y-5 max-w-2xl">
                {event.description.split("\n\n").map((p, i) => (
                  <p key={i} className="text-sm leading-[1.8] text-[hsl(40,20%,70%)]">{p}</p>
                ))}
              </div>

              {/* Q&A section */}
              <div className="mt-14 pt-8 border-t border-[hsl(40,20%,15%)]">
                <QuestionThread questions={questions} />
              </div>
            </motion.div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
