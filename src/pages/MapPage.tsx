import { useState, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { List, SlidersHorizontal, Search, MapPin, X } from "lucide-react";
import { useEvents, useVenues, useCategories } from "@/hooks/useEvents";
import { useUserLocation } from "@/hooks/useUserLocation";
import { CategoryIconBar, CategoryIconRow } from "@/components/events/CategoryPill";
import { type DayTab } from "@/components/events/DaySwitcher";
import { Slider } from "@/components/ui/slider";
import EventMap from "@/components/map/EventMap";
import { isEventStillOnline } from "@/lib/eventStatus";
import { berlinDateString, berlinDateStringOffset } from "@/lib/dateFormat";
import { useFilterParams } from "@/lib/useFilterParams";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";

const parseEntryEuro = (s: string): number | null => {
  const m = s.match(/^(\d+)(?:,(\d{1,2}))?\s*€$/);
  if (!m) return null;
  const whole = parseInt(m[1], 10);
  const frac = m[2] ? parseInt(m[2], 10) / Math.pow(10, m[2].length) : 0;
  return whole + frac;
};

const formatEntryLabel = (v: number) =>
  v === 0 ? "Free" : v >= 20 ? "Any price" : `Up to ${v} €`;

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
  // Mirror Index.tsx — Later spans from day-after-tomorrow to today+14
  const cutoffDate = berlinDateStringOffset(14);

  // Map activeDate (shared URL state with Index) to DaySwitcher tab so
  // navigating Index → Map keeps the user on the same day view.
  const dayTab: DayTab =
    activeDate === "Tomorrow" ? "tomorrow"
    : activeDate === "Later" ? "later"
    : "tonight";

  const handleDayTabChange = useCallback((t: DayTab) => {
    if (t === "tonight") setActiveDate("All");
    else if (t === "tomorrow") setActiveDate("Tomorrow");
    else setActiveDate("Later");
  }, [setActiveDate]);

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
    // Day scoping — same mapping as Index so Tonight/Tomorrow/Later
    // means the same set across both pages.
    if (activeDate === "All" || activeDate === "Today") {
      result = result.filter((e) => e.date === today);
    } else if (activeDate === "Tomorrow") {
      result = result.filter((e) => e.date === tomorrow);
    } else if (activeDate === "Later") {
      result = result.filter((e) => e.date > tomorrow && e.date <= cutoffDate);
    }
    if (activeEntry < 20) {
      // "Frei / Spende" implies a collected donation — semantically the same
      // intent as "Pay what you want", so we group it with free entry.
      // Free-text variants like "Die Band sammelt am Ende" land here too.
      const isFreeOrPwyw = (info: string) =>
        info === "Free"
        || info === "Pay what you want"
        || info === "Frei / Spende"
        || info.toLowerCase().includes("die band sammelt");
      result = result.filter((e) => {
        if (isFreeOrPwyw(e.entryInfo)) return true;
        if (activeEntry === 0) return false;
        const n = parseEntryEuro(e.entryInfo);
        return n !== null && n <= activeEntry;
      });
    }
    return result;
  }, [eventsData, activeCategory, activeNeighborhood, activeDate, activeEntry, searchQuery, today, tomorrow, cutoffDate]);

  const activeFilterCount = activeEntry < 20 ? 1 : 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Filters bar — Map-specific order: DaySwitcher first (closest to
          the pins, since Tonight ↔ Tomorrow is the most frequent toggle
          when scanning a map), then categories below. Deliberately diverges
          from Index, where categories sit on top of a linear list. */}
      <div className="shrink-0 bg-background border-b-2 border-foreground z-[50]">
        {/* Day filter — compact rectangle buttons (Tonight · Tomorrow ·
            Later) keep the Map chrome dense; the dated tab-style
            DaySwitcher is reserved for Index where the page has more
            vertical breathing room. activeDate is still shared via the
            URL so Index ⇄ Map navigation keeps the same day. */}
        <div className="border-b border-border">
          <div className="container flex items-center gap-2 py-2.5">
            {([
              { id: "tonight",  label: "Tonight"  },
              { id: "tomorrow", label: "Tomorrow" },
              { id: "later",    label: "Later"    },
            ] as { id: DayTab; label: string }[]).map((d) => (
              <button
                key={d.id}
                onClick={() => handleDayTabChange(d.id)}
                className={`shrink-0 inline-flex items-center justify-center px-4 py-2 font-mono text-[10px] md:text-xs uppercase tracking-wider border-2 transition-all ${
                  dayTab === d.id
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground hover:bg-foreground hover:text-background"
                }`}
              >
                {d.label}
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
          <div className="border-b border-border bg-background">
            <div className="container py-5">
              <div>
                <label className="mono-label text-muted-foreground mb-3 block">Entry</label>
                <div className="px-1 max-w-md">
                  <Slider
                    value={[activeEntry]}
                    onValueChange={([v]) => setActiveEntry(v)}
                    min={0}
                    max={20}
                    step={1}
                    aria-label="Maximum entry price"
                  />
                  <div className="grid grid-cols-3 items-baseline mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span className="text-left">Free</span>
                    <span className="text-center text-xs font-bold text-foreground">
                      {formatEntryLabel(activeEntry)}
                    </span>
                    <span className="text-right">Max</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Category filters — sits closer to the map as the secondary filter. */}
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

      {/* List button — same black floater as the Map button on Index.
          Border is in the background (cream) color so the button stays
          visible when overlapping the inverted footer. */}
      <button
        onClick={() => navigate({ pathname: "/", search: location.search })}
        className="fixed bottom-6 right-0 z-[9999] flex items-center gap-2 h-12 pl-5 pr-4 bg-foreground text-background font-mono font-bold text-xs uppercase tracking-wider shadow-lg hover:bg-foreground/90 transition-all rounded-l-full border-2 border-r-0 border-background"
      >
        <List className="h-4 w-4" />
        List
      </button>
    </div>
  );
}
