import { useState, useMemo, useCallback } from "react";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";
import { Link } from "react-router-dom";
import { Search, LayoutGrid, MapIcon, SlidersHorizontal, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import EventCard from "@/components/events/EventCard";
import CategoryPill from "@/components/events/CategoryPill";
import MapView from "@/components/events/MapView";
import EventDetailDialog from "@/components/events/EventDetailDialog";
import { useEvents, useCategories } from "@/hooks/useSupabaseData";

const dateFilters = ["All", "Today", "Tomorrow", "This Week"];
const entryFilters = ["All", "Free Entry", "Pay at Venue"];

export default function Index() {
  const { data: allEvents = [], isLoading } = useEvents();
  const { data: categoryInfos = [] } = useCategories();
  const categories = categoryInfos.map(c => c.label);
  const neighborhoods = [...new Set(allEvents.map(e => e.neighborhood))].sort();

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
    let result = [...allEvents];
    result = result.filter((e) => e.date >= today);
    if (searchQuery) {
      result = result.filter(
        (e) => fuzzyMatchAny([e.title, e.venue, e.neighborhood, e.category], searchQuery)
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
    if (activeEntry === "Free Entry") result = result.filter((e) => /free/i.test(e.price));
    if (activeEntry === "Pay at Venue") result = result.filter((e) => !/free/i.test(e.price));
    result.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    const seen = new Set<string>();
    result = result.filter((e) => {
      if (seen.has(e.parentId)) return false;
      seen.add(e.parentId);
      return true;
    });
    return result;
  }, [allEvents, searchQuery, activeCategory, activeNeighborhood, activeDate, activeEntry, today, tomorrow]);

  const handleEventClick = useCallback((eventId: string) => {
    setSelectedEventId(eventId);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <section className="bg-background">
          <div className="container py-16 md:py-24 lg:py-32 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <p className="mono-label text-accent mb-4">Berlin's independent bar guide</p>
              <h1 className="heading-display text-6xl md:text-8xl lg:text-9xl leading-[0.9] max-w-4xl">
                What's on
                <br />
                <span className="heading-editorial text-muted-foreground normal-case">tonight</span>
                <br />
                in Berlin bars
              </h1>
              <p className="mt-8 text-lg text-muted-foreground max-w-lg leading-relaxed font-body">
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
                  className="w-full h-12 pl-10 pr-4 bg-card border border-border text-sm font-body placeholder:text-muted-foreground outline-none focus:border-foreground transition-colors"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {dateFilters.map((d) => (
                  <button
                    key={d}
                    onClick={() => setActiveDate(d)}
                    className={`inline-flex items-center px-4 py-2 font-mono text-xs uppercase tracking-wider border transition-all ${
                      activeDate === d
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:border-foreground"
                    }`}
                  >
                    {d}
                  </button>
                ))}
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-2.5 border transition-colors ${
                      showFilters ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"
                    }`}
                    aria-label="Toggle filters"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </button>
                  <div className="flex border border-border overflow-hidden">
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

        <div className="border-y border-border bg-foreground overflow-hidden py-3">
          <div className="flex animate-marquee whitespace-nowrap">
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className="font-heading text-lg md:text-xl mx-10 text-background tracking-wide flex items-center gap-6 uppercase">
                Drink responsibly, party irresponsibly ✦ Your couch will miss you tonight ✦ Make friends, not plans ✦ Berlin doesn't sleep and neither should you ✦ Find your new favorite bar ✦ Solo night out? We got you ✦ Less scrolling, more clinking ✦
              </span>
            ))}
          </div>
        </div>

        {showFilters && (
          <div className="border-b border-border">
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

        <div className="border-b border-border">
          <div className="container py-4">
            <div className="flex flex-wrap gap-2 overflow-x-auto">
              <CategoryPill label="All" active={!activeCategory} onClick={() => setActiveCategory("")} />
              {categories.map((cat) => (
                <CategoryPill key={cat} label={cat} active={activeCategory === cat} onClick={() => setActiveCategory(cat)} />
              ))}
            </div>
          </div>
        </div>

        <section className="border-b border-border">
          <div className="container py-8 relative">
            <p className="mono-label text-muted-foreground mb-6">{filtered.length} events found</p>

            {viewMode === "map" ? (
              <div className="flex gap-6 h-[calc(100vh-280px)] min-h-[500px]">
                <div className="w-[380px] shrink-0 overflow-y-auto space-y-0 border border-border hidden lg:block">
                  {filtered.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center p-6">
                        <p className="font-heading text-sm uppercase">No events</p>
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
              <div className="text-center py-20 border border-border">
                <p className="font-heading text-lg uppercase">No events found</p>
                <p className="text-sm text-muted-foreground mt-1 font-mono">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="space-y-12">
                {(() => {
                  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
                  const monthEnd = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

                  const sections: { label: string; events: typeof filtered }[] = [];
                  const todayEvents = filtered.filter((e) => e.date === today);
                  const tomorrowEvents = filtered.filter((e) => e.date === tomorrow);
                  const thisWeekEvents = filtered.filter((e) => e.date > tomorrow && e.date <= weekEnd);
                  const laterEvents = filtered.filter((e) => e.date > weekEnd && e.date <= monthEnd);
                  const evenLaterEvents = filtered.filter((e) => e.date > monthEnd);

                  if (todayEvents.length) sections.push({ label: "Today", events: todayEvents });
                  if (tomorrowEvents.length) sections.push({ label: "Tomorrow", events: tomorrowEvents });
                  if (thisWeekEvents.length) sections.push({ label: "This week", events: thisWeekEvents });
                  if (laterEvents.length) sections.push({ label: "This month", events: laterEvents });
                  if (evenLaterEvents.length) sections.push({ label: "Later", events: evenLaterEvents });

                  return sections.map((section) => (
                    <div key={section.label}>
                      <div className="flex items-center gap-4 mb-6 mt-4">
                        <h2 className="font-heading text-3xl md:text-4xl tracking-wide uppercase">{section.label}</h2>
                        <div className="flex-1 border-t border-border" />
                        <span className="mono-label text-lg text-accent">{section.events.length}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {section.events.map((event, i) => (
                          <EventCard key={event.id} event={event} index={i} onClick={handleEventClick} />
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </section>

        <section className="bg-foreground text-background">
          <div className="container py-20 md:py-28 relative z-10">
            <div className="max-w-2xl">
              <p className="mono-label text-accent mb-3">For venues</p>
              <h2 className="font-heading text-4xl md:text-5xl tracking-wide uppercase">
                Run a bar<br />
                <span className="text-background/60">in Berlin?</span>
              </h2>
              <p className="mt-5 text-background/60 text-lg leading-relaxed max-w-md">
                Publish your events and reach locals and travelers looking for a good night out. Free, simple, made for real bars.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  to="/publish"
                  className="inline-flex h-12 px-8 items-center justify-center gap-2 bg-accent text-accent-foreground font-heading text-xs tracking-wider uppercase transition-all hover:bg-accent/90"
                >
                  Publish an event <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/for-bars"
                  className="inline-flex h-12 px-8 items-center justify-center border border-background/20 text-background font-heading text-xs tracking-wider uppercase transition-all hover:bg-background/10"
                >
                  Learn more
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />

      <EventDetailDialog
        eventId={selectedEventId}
        open={!!selectedEventId}
        onOpenChange={(open) => {
          if (!open) setSelectedEventId(null);
        }}
        onEventChange={(id) => setSelectedEventId(id)}
      />
    </div>
  );
}