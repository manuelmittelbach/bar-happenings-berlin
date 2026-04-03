import { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, ArrowRight, LayoutGrid, MapIcon, SlidersHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import EventCard from "@/components/events/EventCard";
import CategoryPill from "@/components/events/CategoryPill";
import MapView from "@/components/events/MapView";
import EventDetailDialog from "@/components/events/EventDetailDialog";
import { events, categories, neighborhoods } from "@/data/mockData";

const dateFilters = ["All", "Today", "Tomorrow", "This Week"];
const entryFilters = ["All", "Free Entry", "Pay at Venue"];

export default function Index() {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");
  const [activeCategory, setActiveCategory] = useState("");
  const [activeNeighborhood, setActiveNeighborhood] = useState("");
  const [activeDate, setActiveDate] = useState("All");
  const [activeEntry, setActiveEntry] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const filtered = useMemo(() => {
    let result = [...events];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.venue.toLowerCase().includes(q) ||
          e.neighborhood.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
      );
    }
    if (activeCategory) result = result.filter((e) => e.category === activeCategory);
    if (activeNeighborhood) result = result.filter((e) => e.neighborhood === activeNeighborhood);
    if (activeDate === "Today") result = result.filter((e) => e.date === today);
    if (activeDate === "Tomorrow") result = result.filter((e) => e.date === tomorrow);
    if (activeDate === "This Week") {
      const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
      result = result.filter((e) => e.date >= today && e.date <= weekEnd);
    }
    if (activeEntry === "Free Entry") result = result.filter((e) => e.entryInfo === "Free Entry");
    if (activeEntry === "Pay at Venue") result = result.filter((e) => e.entryInfo !== "Free Entry");
    return result;
  }, [searchQuery, activeCategory, activeNeighborhood, activeDate, activeEntry, today, tomorrow]);

  const handleEventClick = useCallback((eventId: string) => {
    setSelectedEventId(eventId);
  }, []);

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
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {dateFilters.map((d) => (
                  <button
                    key={d}
                    onClick={() => setActiveDate(d)}
                    className={`inline-flex items-center px-4 py-2 font-mono text-xs uppercase tracking-wider border-2 transition-all ${
                      activeDate === d
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground hover:bg-foreground hover:text-background"
                    }`}
                  >
                    {d}
                  </button>
                ))}
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-2.5 border-2 transition-colors ${
                      showFilters ? "border-foreground bg-foreground text-background" : "border-foreground hover:bg-muted"
                    }`}
                    aria-label="Toggle filters"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </button>
                  <div className="flex border-2 border-foreground overflow-hidden">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`p-2.5 transition-colors ${viewMode === "grid" ? "bg-foreground text-background" : "hover:bg-muted"}`}
                      aria-label="Grid view"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode("map")}
                      className={`p-2.5 transition-colors ${viewMode === "map" ? "bg-foreground text-background" : "hover:bg-muted"}`}
                      aria-label="Map view"
                    >
                      <MapIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
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

        {/* Filters Panel */}
        {showFilters && (
          <div className="border-b-2 border-foreground">
            <div className="container py-5 space-y-5">
              <div>
                <label className="mono-label text-muted-foreground mb-2 block">Neighborhood</label>
                <div className="flex flex-wrap gap-2">
                  <CategoryPill label="All" active={!activeNeighborhood} onClick={() => setActiveNeighborhood("")} />
                  {neighborhoods.map((n) => (
                    <CategoryPill key={n} label={n} active={activeNeighborhood === n} onClick={() => setActiveNeighborhood(n)} />
                  ))}
                </div>
              </div>
              <div>
                <label className="mono-label text-muted-foreground mb-2 block">Entry</label>
                <div className="flex flex-wrap gap-2">
                  {entryFilters.map((e) => (
                    <CategoryPill key={e} label={e} active={activeEntry === e} onClick={() => setActiveEntry(e)} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Category pills */}
        <div className="border-b-2 border-foreground">
          <div className="container py-4">
            <div className="flex flex-wrap gap-2 overflow-x-auto">
              <CategoryPill label="All" active={!activeCategory} onClick={() => setActiveCategory("")} />
              {categories.map((cat) => (
                <CategoryPill key={cat} label={cat} active={activeCategory === cat} onClick={() => setActiveCategory(cat)} />
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <section className="border-b-2 border-foreground">
          <div className="container py-8">
            <p className="mono-label text-muted-foreground mb-6">{filtered.length} events found</p>

            {viewMode === "map" ? (
              <div className="flex gap-6 h-[calc(100vh-280px)] min-h-[500px]">
                <div className="w-[380px] shrink-0 overflow-y-auto space-y-0 border-2 border-foreground hidden lg:block">
                  {filtered.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center p-6">
                        <p className="font-heading text-sm font-bold uppercase">No events</p>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">Try adjusting filters</p>
                      </div>
                    </div>
                  ) : (
                    filtered.map((event, i) => (
                      <EventCard key={event.id} event={event} index={i} layout="list" onClick={handleEventClick} />
                    ))
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <MapView events={filtered} onEventClick={handleEventClick} />
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 border-2 border-border">
                <p className="font-heading text-lg font-bold uppercase">No events found</p>
                <p className="text-sm text-muted-foreground mt-1 font-mono">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filtered.map((event, i) => (
                  <EventCard key={event.id} event={event} index={i} onClick={handleEventClick} />
                ))}
              </div>
            )}
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

      {/* Event Detail Dialog */}
      <EventDetailDialog
        eventId={selectedEventId}
        open={!!selectedEventId}
        onOpenChange={(open) => { if (!open) setSelectedEventId(null); }}
      />
    </div>
  );
}
