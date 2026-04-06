import { useState, useMemo, useCallback } from "react";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, LayoutGrid, List, MapIcon, ChevronRight } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import EventCard from "@/components/events/EventCard";
import CategoryPill, { CategoryIconBar } from "@/components/events/CategoryPill";
import MapView from "@/components/events/MapView";
import { events, categories } from "@/data/mockData";

const sortOptions = ["Recommended", "Today First", "Soonest", "Newly Added"];
const dateFilters = ["All", "Today", "Tomorrow", "This Week"];
const entryFilters = ["All", "Free Entry", "Pay at Venue"];

export default function Explore() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialCategory = searchParams.get("category") || "";
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  
  const [activeDate, setActiveDate] = useState(
    searchParams.get("date") === "today" ? "Today" : searchParams.get("date") === "tomorrow" ? "Tomorrow" : "All"
  );
  const [activeEntry, setActiveEntry] = useState("All");
  const [sortBy, setSortBy] = useState("Recommended");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "map">("grid");
  const [showFilters, setShowFilters] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const filtered = useMemo(() => {
    let result = [...events];
    if (search) {
      result = result.filter(
        (e) => fuzzyMatchAny([e.title, e.venue, e.neighborhood, e.category], search)
      );
    }
    if (activeCategory) result = result.filter((e) => e.category === activeCategory);
    
    if (activeDate === "Today") result = result.filter((e) => e.date === today);
    if (activeDate === "Tomorrow") result = result.filter((e) => e.date === tomorrow);
    if (activeEntry === "Free Entry") result = result.filter((e) => e.entryInfo === "Free Entry");
    if (activeEntry === "Pay at Venue") result = result.filter((e) => e.entryInfo !== "Free Entry");
    if (sortBy === "Soonest")
      result.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    return result;
  }, [search, activeCategory, activeNeighborhood, activeDate, activeEntry, sortBy, today, tomorrow]);

  // Split into 3 tiers: featured (top ~3), standard (next ~8), secondary (rest)
  const { featuredEvents, standardEvents, secondaryEvents } = useMemo(() => {
    const featured: typeof filtered = [];
    const standard: typeof filtered = [];
    const secondary: typeof filtered = [];

    filtered.forEach((e, i) => {
      const hash = e.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
      if (featured.length < 4 && ((hash + i) % 6 === 0 || e.featured)) {
        featured.push(e);
      } else if (standard.length < 8) {
        standard.push(e);
      } else {
        secondary.push(e);
      }
    });

    // Ensure at least 2 featured
    while (featured.length < 2 && standard.length > 0) {
      featured.push(standard.shift()!);
    }

    return { featuredEvents: featured, standardEvents: standard, secondaryEvents: secondary };
  }, [filtered]);

  const handleMapEventClick = useCallback(
    (eventId: string) => {
      navigate(`/event/${eventId}`);
    },
    [navigate]
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* ── Sticky search + categories ── */}
        <div className="sticky top-[57px] z-40 bg-background/95 backdrop-blur-sm border-b-2 border-border">
          <div className="container">
            {/* Search + controls row */}
            <div className="flex items-center gap-2 py-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search events, bars..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-4 bg-muted/50 border-2 border-border text-sm font-mono outline-none focus:border-foreground transition-colors"
                />
              </div>
              {/* Quick date pills */}
              <div className="hidden sm:flex gap-1">
                {dateFilters.map((d) => (
                  <button
                    key={d}
                    onClick={() => setActiveDate(d)}
                    className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider border-2 transition-all ${
                      activeDate === d
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-1.5 h-9 px-3 border-2 text-xs font-mono uppercase tracking-wider transition-all ${
                  showFilters ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Filters</span>
              </button>
              <div className="hidden sm:flex border-2 border-border overflow-hidden">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 transition-colors ${viewMode === "grid" ? "bg-foreground text-background" : "hover:bg-muted"}`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 transition-colors ${viewMode === "list" ? "bg-foreground text-background" : "hover:bg-muted"}`}
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("map")}
                  className={`p-2 transition-colors ${viewMode === "map" ? "bg-foreground text-background" : "hover:bg-muted"}`}
                >
                  <MapIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Category bar */}
            <div className="md:hidden pb-2">
              <CategoryIconBar
                categories={categories}
                activeCategory={activeCategory}
                onSelect={setActiveCategory}
              />
            </div>
            <div className="hidden md:flex gap-1.5 pb-3 overflow-x-auto scrollbar-hide">
              <CategoryPill label="All" active={!activeCategory} onClick={() => setActiveCategory("")} />
              {categories.map((cat) => (
                <CategoryPill key={cat} label={cat} active={activeCategory === cat} onClick={() => setActiveCategory(cat)} />
              ))}
            </div>
          </div>
        </div>

        {/* ── Filters Panel (collapsible) ── */}
        {showFilters && (
          <div className="border-b-2 border-foreground bg-muted/30">
            <div className="container py-4 flex flex-wrap gap-6">
              <div>
                <label className="mono-label text-muted-foreground mb-1.5 block text-[10px]">Date</label>
                <div className="flex flex-wrap gap-1.5 sm:hidden">
                  {dateFilters.map((d) => (
                    <CategoryPill key={d} label={d} active={activeDate === d} onClick={() => setActiveDate(d)} />
                  ))}
                </div>
              </div>
              <div>
                <label className="mono-label text-muted-foreground mb-1.5 block text-[10px]">Entry</label>
                <div className="flex flex-wrap gap-1.5">
                  {entryFilters.map((e) => (
                    <CategoryPill key={e} label={e} active={activeEntry === e} onClick={() => setActiveEntry(e)} />
                  ))}
                </div>
              </div>
              <div>
                <label className="mono-label text-muted-foreground mb-1.5 block text-[10px]">Sort</label>
                <div className="flex flex-wrap gap-1.5">
                  {sortOptions.map((s) => (
                    <CategoryPill key={s} label={s} active={sortBy === s} onClick={() => setSortBy(s)} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Content ── */}
        <div className="container py-6">
          <p className="mono-label text-muted-foreground mb-4 text-[10px]">{filtered.length} events found</p>

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
                    <EventCard key={event.id} event={event} index={i} layout="list" />
                  ))
                )}
              </div>
              <div className="flex-1 min-w-0">
                <MapView events={filtered} onEventClick={handleMapEventClick} />
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 border-2 border-border">
              <p className="font-heading text-lg font-bold uppercase">No events found</p>
              <p className="text-sm text-muted-foreground mt-1 font-mono">Try adjusting your filters</p>
            </div>
          ) : viewMode === "list" ? (
            <div className="space-y-0">
              {filtered.map((event, i) => (
                <EventCard key={event.id} event={event} index={i} layout="list" />
              ))}
            </div>
          ) : (
            <>
              {/* ── TIER 1: Featured — horizontal scroll ── */}
              {featuredEvents.length > 0 && (
                <section className="mb-8">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-heading text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 bg-accent inline-block" />
                      Editor's Picks
                    </h2>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
                    {featuredEvents.map((event, i) => (
                      <EventCard key={event.id} event={event} index={i} layout="grid" featured />
                    ))}
                  </div>
                </section>
              )}

              {/* ── TIER 2: Standard results — grid ── */}
              {standardEvents.length > 0 && (
                <section className="mb-8">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-heading text-sm font-bold uppercase tracking-wider">
                      All Events
                    </h2>
                    <span className="text-[10px] text-muted-foreground font-mono">{standardEvents.length + secondaryEvents.length} more</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {standardEvents.map((event, i) => (
                      <EventCard key={event.id} event={event} index={i} layout="grid" />
                    ))}
                  </div>
                </section>
              )}

              {/* ── TIER 3: Secondary results — compact list ── */}
              {secondaryEvents.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      More Events
                    </h2>
                  </div>
                  <div className="border-2 border-border divide-y divide-border">
                    {secondaryEvents.map((event, i) => (
                      <EventCard key={event.id} event={event} index={i} layout="compact" />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
