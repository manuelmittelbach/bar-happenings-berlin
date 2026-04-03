import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, LayoutGrid, List } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import EventCard from "@/components/events/EventCard";
import CategoryPill from "@/components/events/CategoryPill";
import { events, categories, neighborhoods } from "@/data/mockData";

const sortOptions = ["Recommended", "Today First", "Soonest", "Newly Added"];
const dateFilters = ["All", "Today", "Tomorrow", "This Week"];
const entryFilters = ["All", "Free Entry", "Pay at Venue"];

export default function Explore() {
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get("category") || "";
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [activeNeighborhood, setActiveNeighborhood] = useState("");
  const [activeDate, setActiveDate] = useState(searchParams.get("date") === "today" ? "Today" : searchParams.get("date") === "tomorrow" ? "Tomorrow" : "All");
  const [activeEntry, setActiveEntry] = useState("All");
  const [sortBy, setSortBy] = useState("Recommended");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const filtered = useMemo(() => {
    let result = [...events];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.venue.toLowerCase().includes(q) ||
        e.neighborhood.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      );
    }
    if (activeCategory) result = result.filter(e => e.category === activeCategory);
    if (activeNeighborhood) result = result.filter(e => e.neighborhood === activeNeighborhood);
    if (activeDate === "Today") result = result.filter(e => e.date === today);
    if (activeDate === "Tomorrow") result = result.filter(e => e.date === tomorrow);
    if (activeEntry === "Free Entry") result = result.filter(e => e.entryInfo === "Free Entry");
    if (activeEntry === "Pay at Venue") result = result.filter(e => e.entryInfo !== "Free Entry");
    if (sortBy === "Soonest") result.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    return result;
  }, [search, activeCategory, activeNeighborhood, activeDate, activeEntry, sortBy, today, tomorrow]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container py-8">
          <h1 className="heading-display text-3xl md:text-4xl mb-6">Explore Events</h1>

          {/* Search + Controls */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search events, bars, neighborhoods..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center gap-2 h-10 px-4 border border-border rounded-sm text-sm font-medium hover:bg-muted transition-colors"
              >
                <SlidersHorizontal className="h-4 w-4" /> Filters
              </button>
              <div className="hidden sm:flex border border-border rounded-sm overflow-hidden">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2.5 ${viewMode === "grid" ? "bg-foreground text-background" : "hover:bg-muted"}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2.5 ${viewMode === "list" ? "bg-foreground text-background" : "hover:bg-muted"}`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="border border-border rounded-sm p-4 mb-6 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Date</label>
                <div className="flex flex-wrap gap-2">
                  {dateFilters.map(d => (
                    <CategoryPill key={d} label={d} active={activeDate === d} onClick={() => setActiveDate(d)} />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Neighborhood</label>
                <div className="flex flex-wrap gap-2">
                  <CategoryPill label="All" active={!activeNeighborhood} onClick={() => setActiveNeighborhood("")} />
                  {neighborhoods.map(n => (
                    <CategoryPill key={n} label={n} active={activeNeighborhood === n} onClick={() => setActiveNeighborhood(n)} />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Entry</label>
                <div className="flex flex-wrap gap-2">
                  {entryFilters.map(e => (
                    <CategoryPill key={e} label={e} active={activeEntry === e} onClick={() => setActiveEntry(e)} />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Sort</label>
                <div className="flex flex-wrap gap-2">
                  {sortOptions.map(s => (
                    <CategoryPill key={s} label={s} active={sortBy === s} onClick={() => setSortBy(s)} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Category pills */}
          <div className="flex flex-wrap gap-2 mb-8 overflow-x-auto pb-2">
            <CategoryPill label="All" active={!activeCategory} onClick={() => setActiveCategory("")} />
            {categories.map(cat => (
              <CategoryPill key={cat} label={cat} active={activeCategory === cat} onClick={() => setActiveCategory(cat)} />
            ))}
          </div>

          {/* Results */}
          <p className="text-sm text-muted-foreground mb-4">{filtered.length} events found</p>
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-lg font-heading font-semibold">No events found</p>
              <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or search</p>
            </div>
          ) : (
            <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-4"}>
              {filtered.map((event, i) => (
                viewMode === "grid" ? (
                  <EventCard key={event.id} event={event} index={i} />
                ) : (
                  <EventCard key={event.id} event={event} index={i} />
                )
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
