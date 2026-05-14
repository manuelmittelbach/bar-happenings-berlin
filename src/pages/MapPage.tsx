import { useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { List, Search, MapPin, X } from "lucide-react";
import { useEvents, useVenues, useCategories } from "@/hooks/useEvents";
import { useUserLocation } from "@/hooks/useUserLocation";
import { useIsNative } from "@/hooks/useIsNative";
import { CategoryIconBar, CategoryRowPills } from "@/components/events/CategoryPill";
import DaySwitcher, { type DayTab } from "@/components/events/DaySwitcher";
import EventMap from "@/components/map/EventMap";
import { isEventStillOnline } from "@/lib/eventStatus";
import { berlinDateString, berlinDateStringOffset } from "@/lib/dateFormat";
import { useFilterParams } from "@/lib/useFilterParams";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";

export default function MapPage() {
  const navigate = useNavigate();
  const isNative = useIsNative();
  const {
    searchQuery, setSearchQuery,
    activeCategory, setActiveCategory,
    activeNeighborhood, setActiveNeighborhood,
    activeDate, setActiveDate,
  } = useFilterParams();

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
    return result;
  }, [eventsData, activeCategory, activeNeighborhood, activeDate, searchQuery, today, tomorrow, cutoffDate]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Day filter: rectangle buttons on mobile (compact, dense), the
          full DaySwitcher tab-style on desktop so the day chrome reads
          consistently with Index. Filters drawer was deliberately
          removed from the Map. */}
      <div className="shrink-0 bg-background border-b-2 border-foreground md:border-b-0 z-[50]">
        {/* Mobile keeps the 2px foreground rule as the map's hard top edge.
            Desktop drops the rule — the map fades into the background via
            the gradient overlay below for a softer editorial feel. */}
        <div>
          {/* Mobile — rectangle buttons */}
          <div className="md:hidden container flex items-center gap-2 py-2.5">
            {([
              { id: "tonight",  label: "Tonight"  },
              { id: "tomorrow", label: "Tomorrow" },
              { id: "later",    label: "Later"    },
            ] as { id: DayTab; label: string }[]).map((d) => (
              <button
                key={d.id}
                onClick={() => handleDayTabChange(d.id)}
                className={`shrink-0 inline-flex items-center justify-center px-4 py-2 rounded-full font-mono text-[10px] uppercase tracking-wider border-2 transition-all ${
                  dayTab === d.id
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground hover:bg-foreground hover:text-background"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          {/* Desktop — DaySwitcher (matches Index) */}
          <div className="hidden md:block container">
            <DaySwitcher active={dayTab} onChange={handleDayTabChange} />
          </div>
        </div>

        {/* Category filters — sits closer to the map as the secondary filter. */}
        <div className="container py-1.5 md:py-3">
          <div className="md:hidden">
            <CategoryIconBar
              categories={categories}
              activeCategory={activeCategory}
              onSelect={setActiveCategory}
            />
          </div>
          <div className="hidden md:block">
            <CategoryRowPills
              categories={categories}
              activeCategory={activeCategory}
              onSelect={setActiveCategory}
            />
          </div>
        </div>
      </div>

      {/* Map fills remaining height */}
      <div className="flex-1 min-h-0 relative">
        {/* Desktop-only top fade — softens the seam between chrome and map.
            Mobile keeps the hard 2px foreground rule (see chrome above) so
            the brutalist editorial language stays intact on phones. */}
        <div
          aria-hidden
          className="hidden md:block pointer-events-none absolute inset-x-0 top-0 z-[100] h-16"
          style={{
            background:
              "linear-gradient(to bottom, hsl(var(--background)) 0%, hsl(var(--background) / 0.85) 35%, hsl(var(--background) / 0) 100%)",
          }}
        />
        <div className="absolute top-2 right-2 z-[9999] bg-black/70 text-white text-xs px-2 py-1 font-mono pointer-events-none">
          {filtered.length} {filtered.length === 1 ? "event" : "events"} {dayTab}
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

      {/* List button — only on web (desktop + mobile browser). In the
          native iOS app the BottomTabBar already exposes a "List" tab,
          so a floating List FAB on the map would be redundant chrome. */}
      {!isNative && (
        <button
          onClick={() => navigate("/")}
          style={{
            bottom: "var(--fab-bottom)",
            fontSize: 12,
            letterSpacing: "0.14em",
          }}
          className="fixed right-0 md:right-4 z-[9999] inline-flex h-12 w-12 md:w-auto items-center justify-center gap-2 md:px-5 bg-foreground text-background font-mono font-bold md:font-normal uppercase border-2 border-r-0 md:border-r-2 border-background md:border-foreground rounded-l-full md:rounded-none shadow-lg md:shadow-none transition-colors hover:bg-foreground/90 md:hover:bg-background md:hover:text-foreground"
          aria-label="Open list view"
        >
          <List className="h-4 w-4" />
          <span className="hidden md:inline">List</span>
        </button>
      )}
    </div>
  );
}
