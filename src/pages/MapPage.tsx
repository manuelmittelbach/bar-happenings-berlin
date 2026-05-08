import { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { List, SlidersHorizontal, Search, MapPin, X } from "lucide-react";
import { useEvents, useVenues, useCategories } from "@/hooks/useEvents";
import { useUserLocation } from "@/hooks/useUserLocation";
import CategoryPill, { CategoryIconBar, CategoryIconRow } from "@/components/events/CategoryPill";
import EventMap from "@/components/map/EventMap";
import { isEventStillOnline } from "@/lib/eventStatus";
import { berlinDateString, berlinDateStringOffset } from "@/lib/dateFormat";
import { useFilterParams } from "@/lib/useFilterParams";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";

const dateFilters = ["All", "Today", "Tomorrow"];
const entryFilters = ["All", "Free", "Pay what you want", "0-5 €", "0-10 €"];

const parseEntryEuro = (s: string): number | null => {
  const m = s.match(/^(\d+)(?:,(\d{1,2}))?\s*€$/);
  if (!m) return null;
  const whole = parseInt(m[1], 10);
  const frac = m[2] ? parseInt(m[2], 10) / Math.pow(10, m[2].length) : 0;
  return whole + frac;
};

export default function MapPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    searchQuery, setSearchQuery,
    activeCategory, setActiveCategory,
    activeNeighborhood, setActiveNeighborhood,
    activeDate, setActiveDate,
    activeEntry, setActiveEntry,
  } = useFilterParams();
  const [showFilters, setShowFilters] = useState(false);

  const { data: eventsData = [] } = useEvents();
  const { data: venuesData = [] } = useVenues();
  const { data: categoriesData = [] } = useCategories();
  // Slug-IDs (categories.id) — passed to CategoryPill and used as activeCategory value.
  const categories = useMemo(
    () => categoriesData.filter((c) => c.enabled).map((c) => c.id),
    [categoriesData],
  );
  const { location: userLocation } = useUserLocation();

  const venueMap = useMemo(
    () => Object.fromEntries(venuesData.map((v) => [v.id, v])),
    [venuesData]
  );

  const today = berlinDateString();
  const tomorrow = berlinDateStringOffset(1);

  const filtered = useMemo(() => {
    let result = [...eventsData];
    result = result.filter((e) => isEventStillOnline(e));
    // Hide canceled events unless they're today or tomorrow — same rule as list view.
    result = result.filter((e) => {
      if (e.status !== "canceled") return true;
      return e.date === today || e.date === tomorrow;
    });
    if (searchQuery) result = result.filter((e) => fuzzyMatchAny([e.venue], searchQuery));
    if (activeCategory) result = result.filter((e) => e.category === activeCategory);
    if (activeNeighborhood) result = result.filter((e) => e.neighborhood === activeNeighborhood);
    if (activeDate === "Today") result = result.filter((e) => e.date === today);
    if (activeDate === "Tomorrow") result = result.filter((e) => e.date === tomorrow);
    const isFree = (info: string) => info === "Free" || info === "Frei / Spende";
    // Free-text variants like "Die Band sammelt am Ende" count as
    // pay-what-you-want — collected donation, no fixed price.
    const isPayWhatYouWant = (info: string) =>
      info === "Pay what you want" || info.toLowerCase().includes("die band sammelt");
    if (activeEntry === "Free") result = result.filter((e) => isFree(e.entryInfo));
    if (activeEntry === "Pay what you want") result = result.filter((e) =>
      isPayWhatYouWant(e.entryInfo) || isFree(e.entryInfo)
    );
    if (activeEntry === "0-5 €") result = result.filter((e) => {
      if (isFree(e.entryInfo) || isPayWhatYouWant(e.entryInfo)) return true;
      const n = parseEntryEuro(e.entryInfo);
      return n !== null && n <= 5;
    });
    if (activeEntry === "0-10 €") result = result.filter((e) => {
      if (isFree(e.entryInfo) || isPayWhatYouWant(e.entryInfo)) return true;
      const n = parseEntryEuro(e.entryInfo);
      return n !== null && n <= 10;
    });
    return result;
  }, [eventsData, activeCategory, activeNeighborhood, activeDate, activeEntry, searchQuery, today, tomorrow]);

  const activeFilterCount = activeEntry !== "All" ? 1 : 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Filters bar */}
      <div className="shrink-0 bg-background border-b-2 border-foreground z-[50]">
        {/* Date filters + Filters button */}
        <div className="border-b border-border">
          <div className="container flex items-center gap-2 py-2.5">
            {dateFilters.map((d) => (
              <button
                key={d}
                onClick={() => setActiveDate(d)}
                className={`shrink-0 inline-flex items-center justify-center px-4 py-2 font-mono text-[10px] md:text-xs uppercase tracking-wider border-2 transition-all ${
                  activeDate === d
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground hover:bg-foreground hover:text-background"
                }`}
              >
                {d}
              </button>
            ))}
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`ml-auto shrink-0 inline-flex items-center gap-1.5 px-4 py-2 font-mono text-[10px] md:text-xs uppercase tracking-wider border-2 transition-all ${
                showFilters
                  ? "border-foreground bg-foreground text-background"
                  : "border-foreground hover:bg-foreground hover:text-background"
              }`}
              aria-expanded={showFilters}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold leading-none ${
                  showFilters
                    ? "bg-background text-foreground"
                    : "bg-accent text-accent-foreground"
                }`}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="border-b-2 border-foreground bg-background">
            <div className="container py-5">
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

        {/* Category filters */}
        <div className="container py-3">
          <div className="md:hidden">
            <CategoryIconBar
              categories={categories}
              activeCategory={activeCategory}
              onSelect={setActiveCategory}
            />
          </div>
          <div className="hidden md:block">
            <CategoryIconRow
              categories={categories}
              activeCategory={activeCategory}
              onSelect={setActiveCategory}
            />
          </div>
        </div>
      </div>

      {/* Map fills remaining height */}
      <div className="flex-1 min-h-0 relative">
        <div className="absolute top-2 right-2 z-[9999] bg-black/70 text-white text-xs px-2 py-1 font-mono pointer-events-none">
          {filtered.length} {filtered.length === 1 ? "event" : "events"}
        </div>
        {(searchQuery || activeNeighborhood) && (
          <div className="absolute top-2 left-2 z-[9999] flex flex-wrap items-center gap-2 max-w-[calc(100%-7rem)]">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-background border-2 border-foreground text-[11px] font-mono uppercase tracking-wider hover:bg-muted transition-colors shadow-md"
              >
                <Search className="h-3 w-3" />
                <span className="normal-case">{searchQuery}</span>
                <X className="h-3 w-3 ml-0.5 opacity-60" />
              </button>
            )}
            {activeNeighborhood && (
              <button
                onClick={() => setActiveNeighborhood("")}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-background border-2 border-foreground text-[11px] font-mono uppercase tracking-wider hover:bg-muted transition-colors shadow-md"
              >
                <MapPin className="h-3 w-3" />
                <span>{activeNeighborhood}</span>
                <X className="h-3 w-3 ml-0.5 opacity-60" />
              </button>
            )}
          </div>
        )}
        <EventMap
          events={filtered}
          venueMap={venueMap}
          userLocation={userLocation}
          onEventClick={(id) => navigate(`/event/${id}`)}
        />
      </div>

      {/* List button — same style as Map button on main page */}
      <button
        onClick={() => navigate({ pathname: "/", search: location.search })}
        className="fixed bottom-6 right-0 z-[9999] flex items-center gap-2 h-12 pl-5 pr-4 bg-accent text-accent-foreground font-mono font-bold text-xs uppercase tracking-wider shadow-lg hover:bg-accent/90 transition-all rounded-l-full border-2 border-r-0 border-accent"
      >
        <List className="h-4 w-4" />
        List
      </button>
    </div>
  );
}
