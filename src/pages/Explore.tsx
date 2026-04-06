import { useState, useMemo, useCallback } from "react";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, LayoutGrid, List, MapIcon } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import EventCard from "@/components/events/EventCard";
import CategoryPill, { CategoryIconBar } from "@/components/events/CategoryPill";
import MapView from "@/components/events/MapView";
import { events, categories, neighborhoods } from "@/data/mockData";

const sortOptions = ["Recommended", "Today First", "Soonest", "Newly Added"];
const dateFilters = ["All", "Today", "Tomorrow", "This Week"];
const entryFilters = ["All", "Free Entry", "Pay at Venue"];

export default function Explore() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialCategory = searchParams.get("category") || "";
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [activeNeighborhood, setActiveNeighborhood] = useState("");
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
    if (activeNeighborhood) result = result.filter((e) => e.neighborhood === activeNeighborhood);
    if (activeDate === "Today") result = result.filter((e) => e.date === today);
    if (activeDate === "Tomorrow") result = result.filter((e) => e.date === tomorrow);
    if (activeEntry === "Free Entry") result = result.filter((e) => e.entryInfo === "Free Entry");
    if (activeEntry === "Pay at Venue") result = result.filter((e) => e.entryInfo !== "Free Entry");
    if (sortBy === "Soonest")
      result.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    return result;
  }, [search, activeCategory, activeNeighborhood, activeDate, activeEntry, sortBy, today, tomorrow]);

  // Deterministic ~5% featured picks based on event id hash
  const featuredIds = useMemo(() => {
    const set = new Set<string>();
    filtered.forEach((e, i) => {
      // Pick roughly every 8th event (~12%)
      const hash = e.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
      if ((hash + i) % 8 === 0) set.add(e.id);
    });
    // Ensure at least 1 featured if we have events
    if (set.size === 0 && filtered.length >= 3) {
      set.add(filtered[0].id);
    }
    return set;
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
        <div className="container py-10">
          <div className="mb-8">
            <p className="mono-label text-accent mb-2">Discover</p>
            <h1 className="heading-display text-3xl md:text-5xl">Explore Events</h1>
          </div>

          {/* Search + Controls */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search events, bars, neighborhoods..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-background border-2 border-border text-sm font-mono outline-none focus:border-foreground transition-colors"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-2 h-10 px-4 border-2 text-sm font-mono uppercase tracking-wider transition-all ${
                  showFilters ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" /> Filters
              </button>
              <div className="hidden sm:flex border-2 border-border overflow-hidden">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2.5 transition-colors ${viewMode === "grid" ? "bg-foreground text-background" : "hover:bg-muted"}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2.5 transition-colors ${viewMode === "list" ? "bg-foreground text-background" : "hover:bg-muted"}`}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("map")}
                  className={`p-2.5 transition-colors ${viewMode === "map" ? "bg-foreground text-background" : "hover:bg-muted"}`}
                >
                  <MapIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="border-2 border-foreground p-5 mb-6 space-y-5">
              <div>
                <label className="mono-label text-muted-foreground mb-2 block">Date</label>
                <div className="flex flex-wrap gap-2">
                  {dateFilters.map((d) => (
                    <CategoryPill key={d} label={d} active={activeDate === d} onClick={() => setActiveDate(d)} />
                  ))}
                </div>
              </div>
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
              <div>
                <label className="mono-label text-muted-foreground mb-2 block">Sort</label>
                <div className="flex flex-wrap gap-2">
                  {sortOptions.map((s) => (
                    <CategoryPill key={s} label={s} active={sortBy === s} onClick={() => setSortBy(s)} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Category filters — icon bar on mobile, pills on desktop */}
          <div className="md:hidden mb-6">
            <CategoryIconBar
              categories={categories}
              activeCategory={activeCategory}
              onSelect={setActiveCategory}
            />
          </div>
          <div className="hidden md:flex flex-wrap gap-2 mb-8">
            <CategoryPill label="All" active={!activeCategory} onClick={() => setActiveCategory("")} />
            {categories.map((cat) => (
              <CategoryPill key={cat} label={cat} active={activeCategory === cat} onClick={() => setActiveCategory(cat)} />
            ))}
          </div>

          {/* Results */}
          <p className="mono-label text-muted-foreground mb-6">{filtered.length} events found</p>

          {viewMode === "map" ? (
            <div className="flex gap-6 h-[calc(100vh-280px)] min-h-[500px]">
              {/* Event list sidebar */}
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
              {/* Map */}
              <div className="flex-1 min-w-0">
                <MapView events={filtered} onEventClick={handleMapEventClick} />
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 border-2 border-border">
              <p className="font-heading text-lg font-bold uppercase">No events found</p>
              <p className="text-sm text-muted-foreground mt-1 font-mono">Try adjusting your filters</p>
            </div>
          ) : (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                  : "space-y-0"
              }
            >
              {filtered.map((event, i) => (
                <EventCard key={event.id} event={event} index={i} layout={viewMode} featured={viewMode === "grid" && featuredIds.has(event.id)} />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
