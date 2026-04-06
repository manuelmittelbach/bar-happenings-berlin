import { useState, useMemo, useCallback } from "react";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";
import { Link } from "react-router-dom";
import { Search, LayoutGrid, MapIcon, SlidersHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import EventCard from "@/components/events/EventCard";
import CategoryPill, { CategoryIconBar } from "@/components/events/CategoryPill";
import MapView from "@/components/events/MapView";
import EventDetailDialog from "@/components/events/EventDetailDialog";
import { events, categories } from "@/data/mockData";

const dateFilters = ["All", "Today", "Tomorrow", "This Week"];
const entryFilters = ["All", "Free Entry", "Pay at Venue"];

export default function Index() {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");
  const [activeCategory, setActiveCategory] = useState("");
  
  const [activeDate, setActiveDate] = useState("All");
  const [activeEntry, setActiveEntry] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const filtered = useMemo(() => {
    let result = [...events];

    result = result.filter((e) => e.date >= today);

    if (searchQuery) {
      result = result.filter(
        (e) => fuzzyMatchAny([e.title, e.venue, e.neighborhood, e.category], searchQuery)
      );
    }
    if (activeCategory) result = result.filter((e) => e.category === activeCategory);
    
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
  }, [searchQuery, activeCategory, activeDate, activeEntry, today, tomorrow]);

  // Deterministic ~12% featured picks
  const featuredIds = useMemo(() => {
    const set = new Set<string>();
    filtered.forEach((e, i) => {
      const hash = e.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
      if ((hash + i) % 8 === 0) set.add(e.id);
    });
    if (set.size === 0 && filtered.length >= 3) {
      set.add(filtered[0].id);
    }
    return set;
  }, [filtered]);

  const handleEventClick = useCallback((eventId: string) => {
    setSelectedEventId(eventId);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <section className="border-b-2 border-foreground noise-bg max-h-[40vh] overflow-hidden">
          <div className="container py-8 md:py-10 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6"
            >
              <div>
                <p className="mono-label text-accent mb-2">Berlin's independent bar guide</p>
                <h1 className="heading-display text-3xl md:text-[48px] leading-[1] max-w-2xl">
                  What's on
                  {" "}
                  <span className="heading-editorial lowercase italic">tonight</span>
                  {" "}
                  in Berlin bars
                </h1>
              </div>

              <div className="flex-1 max-w-lg">
                <div className="relative flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search by bar, neighborhood, or event..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 bg-background border-2 border-foreground text-sm font-mono placeholder:text-muted-foreground outline-none focus:bg-muted transition-colors"
                    />
                  </div>
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 border border-accent/30 text-accent text-xs font-mono font-bold whitespace-nowrap"
                  >
                    <motion.span
                      key={filtered.length}
                      initial={{ y: -8, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      {filtered.length}
                    </motion.span>
                    {" "}events this week
                  </motion.span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {dateFilters.map((d) => (
                    <button
                      key={d}
                      onClick={() => setActiveDate(d)}
                      className={`inline-flex items-center px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider border-2 transition-all ${
                        activeDate === d
                          ? "border-foreground bg-foreground text-background"
                          : "border-foreground hover:bg-foreground hover:text-background"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                  <div className="ml-auto flex gap-1.5">
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`p-2 border-2 transition-colors ${
                        showFilters ? "border-foreground bg-foreground text-background" : "border-foreground hover:bg-muted"
                      }`}
                      aria-label="Toggle filters"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                    </button>
                    <div className="flex border-2 border-foreground overflow-hidden">
                      <button
                        onClick={() => setViewMode("grid")}
                        className={`p-2 transition-colors ${viewMode === "grid" ? "bg-foreground text-background" : "hover:bg-muted"}`}
                        aria-label="Grid view"
                      >
                        <LayoutGrid className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setViewMode("map")}
                        className={`p-2 transition-colors ${viewMode === "map" ? "bg-foreground text-background" : "hover:bg-muted"}`}
                        aria-label="Map view"
                      >
                        <MapIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>


        {showFilters && (
          <div className="border-b-2 border-foreground">
            <div className="container py-5 space-y-5">
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

        <div className="sticky top-[57px] z-40 bg-background/95 backdrop-blur-sm border-b-2 border-foreground">
          {/* Category row */}
          <div className="container py-3">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide whitespace-nowrap pb-1">
              {/* Mobile: icon scroller */}
              <div className="md:hidden flex gap-1">
                <CategoryIconBar
                  categories={categories}
                  activeCategory={activeCategory}
                  onSelect={setActiveCategory}
                />
              </div>
              {/* Desktop: pill row (no wrap) */}
              <div className="hidden md:flex gap-2">
                <CategoryPill label="All" active={!activeCategory} onClick={() => setActiveCategory("")} />
                {categories.map((cat) => (
                  <CategoryPill key={cat} label={cat} active={activeCategory === cat} onClick={() => setActiveCategory(cat)} />
                ))}
              </div>
            </div>
          </div>
        </div>

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
                        <h2 className="font-heading text-3xl md:text-4xl font-extrabold uppercase tracking-tight">{section.label}</h2>
                        <div className="flex-1 border-t-2 border-border" />
                        <span className="mono-label text-lg text-muted-foreground">{section.events.length}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {section.events.map((event, i) => (
                          <EventCard key={event.id} event={event} index={i} onClick={handleEventClick} featured={featuredIds.has(event.id)} />
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </section>

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
