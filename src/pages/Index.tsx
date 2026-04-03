import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, ArrowRight, LayoutGrid, MapIcon } from "lucide-react";
import { motion } from "framer-motion";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import EventCard from "@/components/events/EventCard";
import CategoryPill from "@/components/events/CategoryPill";
import MapView from "@/components/events/MapView";
import { getTodayEvents, getTomorrowEvents, getThisWeekEvents, categories } from "@/data/mockData";

export default function Index() {
  const [searchQuery, setSearchQuery] = useState("");
  const todayEvents = getTodayEvents();
  const tomorrowEvents = getTomorrowEvents();
  const allEvents = getThisWeekEvents();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="border-b-2 border-foreground noise-bg">
          <div className="container py-16 md:py-24 lg:py-32 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <p className="mono-label text-accent mb-4">Berlin's independent bar guide</p>
              <h1 className="heading-display text-5xl md:text-7xl lg:text-8xl leading-[0.95] max-w-4xl">
                What's on
                <br />
                <span className="heading-editorial lowercase italic">tonight</span>
                <br />
                in Berlin bars
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-lg leading-relaxed">
                Live music, quiz nights, open mics, and community events in small independent bars across the city.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-10 max-w-lg"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by bar, neighborhood, or event..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-10 pr-4 bg-background border-2 border-foreground text-sm font-mono placeholder:text-muted-foreground outline-none focus:bg-muted transition-colors"
                />
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <Link to="/explore?date=today" className="inline-flex items-center px-4 py-2 font-mono text-xs uppercase tracking-wider border-2 border-foreground hover:bg-foreground hover:text-background transition-all">
                  Today
                </Link>
                <Link to="/explore?date=tomorrow" className="inline-flex items-center px-4 py-2 font-mono text-xs uppercase tracking-wider border-2 border-foreground hover:bg-foreground hover:text-background transition-all">
                  Tomorrow
                </Link>
                <Link to="/explore" className="inline-flex items-center px-4 py-2 font-mono text-xs uppercase tracking-wider border-2 border-foreground hover:bg-foreground hover:text-background transition-all">
                  This Week
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Marquee */}
        <div className="border-b-2 border-foreground bg-accent text-accent-foreground overflow-hidden py-2">
          <div className="flex animate-marquee whitespace-nowrap">
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className="mono-label text-[11px] mx-8">
                Live Music · Quiz Nights · Open Mic · Poetry · DJ Sets · Language Exchange · Comedy · Film Screenings · Board Games · Workshops · Community Events · Social Hangouts ·
              </span>
            ))}
          </div>
        </div>

        {/* Happening Today */}
        <section className="border-b-2 border-foreground">
          <div className="container py-14">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="mono-label text-accent mb-2">Happening now</p>
                <h2 className="heading-display text-3xl md:text-4xl">Today in Berlin</h2>
              </div>
              <Link to="/explore?date=today" className="hidden sm:inline-flex items-center gap-1 mono-label text-muted-foreground hover:text-foreground transition-colors">
                All today <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {todayEvents.map((event, i) => (
                <EventCard key={event.id} event={event} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* Tomorrow */}
        <section className="border-b-2 border-foreground">
          <div className="container py-14">
            <div className="flex items-end justify-between mb-10">
              <h2 className="heading-display text-3xl md:text-4xl">Tomorrow</h2>
              <Link to="/explore?date=tomorrow" className="hidden sm:inline-flex items-center gap-1 mono-label text-muted-foreground hover:text-foreground transition-colors">
                All tomorrow <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {tomorrowEvents.map((event, i) => (
                <EventCard key={event.id} event={event} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="border-b-2 border-foreground">
          <div className="container py-14">
            <p className="mono-label text-muted-foreground mb-3">Browse by</p>
            <h2 className="heading-display text-3xl md:text-4xl mb-8">Category</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Link key={cat} to={`/explore?category=${encodeURIComponent(cat)}`}>
                  <CategoryPill label={cat} />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* This Week */}
        <section className="border-b-2 border-foreground">
          <div className="container py-14">
            <div className="flex items-end justify-between mb-10">
              <h2 className="heading-display text-3xl md:text-4xl">This Week</h2>
              <Link to="/explore" className="hidden sm:inline-flex items-center gap-1 mono-label text-muted-foreground hover:text-foreground transition-colors">
                See all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {allEvents.slice(4).map((event, i) => (
                <EventCard key={event.id} event={event} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* For Bars CTA */}
        <section className="bg-foreground text-primary-foreground noise-bg">
          <div className="container py-20 md:py-28 relative z-10">
            <div className="max-w-2xl">
              <p className="mono-label text-accent mb-3">For venues</p>
              <h2 className="font-heading text-4xl md:text-5xl font-extrabold uppercase tracking-tight">
                Run a bar<br />in Berlin?
              </h2>
              <p className="mt-5 text-primary-foreground/60 text-lg leading-relaxed max-w-md">
                Publish your events and reach locals looking for something to do tonight. Free, simple, and made for independent venues.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  to="/publish"
                  className="inline-flex h-12 px-8 items-center justify-center border-2 border-accent bg-accent text-accent-foreground font-heading text-xs font-bold uppercase tracking-wider transition-all hover:bg-transparent hover:text-accent"
                >
                  Publish an event
                </Link>
                <Link
                  to="/for-bars"
                  className="inline-flex h-12 px-8 items-center justify-center border-2 border-primary-foreground/30 text-primary-foreground font-heading text-xs font-bold uppercase tracking-wider transition-all hover:border-primary-foreground"
                >
                  Learn more
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
