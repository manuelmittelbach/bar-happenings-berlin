import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import EventCard from "@/components/events/EventCard";
import CategoryPill from "@/components/events/CategoryPill";
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
        <section className="border-b border-border">
          <div className="container py-16 md:py-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-3xl"
            >
              <h1 className="heading-display text-4xl md:text-6xl lg:text-7xl leading-[1.05]">
                Find what's happening
                <br />
                <span className="heading-editorial font-light">tonight in Berlin bars</span>
              </h1>
              <p className="mt-5 text-lg text-muted-foreground max-w-xl leading-relaxed">
                Discover live music, quiz nights, open mics, and community events in small independent bars across Berlin.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-8 max-w-xl"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by bar, neighborhood, or event..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-10 pr-4 bg-muted/50 border border-border rounded-sm text-sm placeholder:text-muted-foreground outline-none focus:border-foreground transition-colors"
                />
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <Link to="/explore?date=today" className="inline-flex items-center px-3 py-1.5 text-xs font-medium border border-border rounded-sm hover:bg-muted transition-colors">
                  Today
                </Link>
                <Link to="/explore?date=tomorrow" className="inline-flex items-center px-3 py-1.5 text-xs font-medium border border-border rounded-sm hover:bg-muted transition-colors">
                  Tomorrow
                </Link>
                <Link to="/explore?date=week" className="inline-flex items-center px-3 py-1.5 text-xs font-medium border border-border rounded-sm hover:bg-muted transition-colors">
                  This Week
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Happening Today */}
        <section className="border-b border-border">
          <div className="container py-12">
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-accent">Happening Now</span>
                </div>
                <h2 className="heading-display text-2xl md:text-3xl">Today in Berlin Bars</h2>
              </div>
              <Link to="/explore?date=today" className="hidden sm:inline-flex items-center gap-1 text-sm font-medium hover:text-accent transition-colors">
                See all <ArrowRight className="h-4 w-4" />
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
        <section className="border-b border-border">
          <div className="container py-12">
            <div className="flex items-center justify-between mb-8">
              <h2 className="heading-display text-2xl md:text-3xl">Tomorrow</h2>
              <Link to="/explore?date=tomorrow" className="hidden sm:inline-flex items-center gap-1 text-sm font-medium hover:text-accent transition-colors">
                See all <ArrowRight className="h-4 w-4" />
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
        <section className="border-b border-border">
          <div className="container py-12">
            <h2 className="heading-display text-2xl md:text-3xl mb-6">Browse by Category</h2>
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
        <section className="border-b border-border">
          <div className="container py-12">
            <div className="flex items-center justify-between mb-8">
              <h2 className="heading-display text-2xl md:text-3xl">This Week</h2>
              <Link to="/explore" className="hidden sm:inline-flex items-center gap-1 text-sm font-medium hover:text-accent transition-colors">
                See all <ArrowRight className="h-4 w-4" />
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
        <section className="bg-foreground text-background">
          <div className="container py-16 md:py-20">
            <div className="max-w-2xl">
              <h2 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">
                Run a bar in Berlin?
              </h2>
              <p className="mt-4 text-background/70 text-lg leading-relaxed">
                Publish your events and reach locals looking for something to do tonight. It's free, simple, and made for small independent venues.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  to="/publish"
                  className="inline-flex h-11 px-6 items-center justify-center rounded-sm bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors"
                >
                  Publish an event
                </Link>
                <Link
                  to="/for-bars"
                  className="inline-flex h-11 px-6 items-center justify-center rounded-sm border border-background/20 text-background font-medium text-sm hover:bg-background/10 transition-colors"
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
