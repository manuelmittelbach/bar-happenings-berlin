import { useMemo, useCallback, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, X } from "lucide-react";
import { useEvents, useVenues, useCategories } from "@/hooks/useEvents";
import { useUserLocation } from "@/hooks/useUserLocation";
import { CategoryIconBar, CategoryRowPills } from "@/components/events/CategoryPill";
import DaySwitcher, { type DayTab } from "@/components/events/DaySwitcher";
import EventMap from "@/components/map/EventMap";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/error-state";
import { isEventStillOnline } from "@/lib/eventStatus";
import { daySlot } from "@/lib/eventListing";
import { berlinDateString, berlinDateStringOffset } from "@/lib/dateFormat";
import { useFilterParams } from "@/lib/useFilterParams";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";

export default function MapPage() {
  const navigate = useNavigate();
  const {
    searchQuery, setSearchQuery,
    activeCategory, setActiveCategory,
    activeNeighborhood, setActiveNeighborhood,
    activeDate, setActiveDate,
  } = useFilterParams();

  // `isPending` (not `isLoading`) — during the PersistQueryClient cache
  // restore on refresh the query is paused (fetchStatus 'idle') with no data
  // yet, so `isLoading` (= isPending && isFetching) is briefly false. That
  // window is exactly when the count badge would flash "0 events" before the
  // fetch even starts. `isPending` stays true until events actually arrive.
  const { data: eventsData = [], isPending: eventsPending, isLoading: eventsLoading, refetch: refetchEvents } = useEvents();
  const { data: venuesData = [], isLoading: venuesLoading, refetch: refetchVenues, isFetching: venuesFetching } = useVenues();
  const { data: categoriesData = [] } = useCategories();
  // `venueMap` empty (venues still loading or fetch failed) silently drops
  // every event from the map layer in EventMap, since each event needs a
  // venue with lat/lng to become a marker. That produces the "badge says
  // 19 events but the map is empty" bug. We detect the gap here so the
  // overlay below can show a loading or error state instead of an empty
  // map while events appear to be present.
  const venuesMissing = !venuesLoading && venuesData.length === 0;
  const stillLoading = eventsLoading || venuesLoading;

  // Don't flash the overlay from the very first frame — on a fast (or
  // cached) load the data arrives within a few hundred ms, so showing
  // "Loading map…"/"Venues unavailable" immediately just causes a
  // jarring flicker. Wait out a short grace period and only surface the
  // overlay if we're STILL loading / venues are still missing by then.
  const overlayPending = stillLoading || venuesMissing;
  const [showOverlay, setShowOverlay] = useState(false);
  useEffect(() => {
    if (!overlayPending) {
      setShowOverlay(false);
      return;
    }
    const t = setTimeout(() => setShowOverlay(true), 700);
    return () => clearTimeout(t);
  }, [overlayPending]);
  // Slug-IDs (categories.id) — passed to CategoryPill and used as activeCategory value.
  const categories = useMemo(
    () => categoriesData.filter((c) => c.enabled).map((c) => c.id),
    [categoriesData],
  );
  // watch: true → live-track the device so the blue dot follows the user as
  // they move (like Google Maps), instead of only updating on a manual locate.
  const { location: userLocation } = useUserLocation({ watch: true });

  const venueMap = useMemo(
    () => Object.fromEntries(venuesData.map((v) => [v.id, v])),
    [venuesData]
  );

  const today = berlinDateString();
  const tomorrow = berlinDateStringOffset(1);

  // Map activeDate (shared URL state with Index) to DaySwitcher tab so
  // navigating Index → Map keeps the user on the same day view.
  const dayTab: DayTab =
    activeDate === "Tomorrow" ? "tomorrow"
    : activeDate === "Upcoming" ? "upcoming"
    : "tonight";

  const handleDayTabChange = useCallback((t: DayTab) => {
    if (t === "tonight") setActiveDate("All");
    else if (t === "tomorrow") setActiveDate("Tomorrow");
    else setActiveDate("Upcoming");
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
    // Day scoping via daySlot so Tonight/Tomorrow/Upcoming means the exact
    // same set as Index (both now share the one Upcoming horizon).
    const slot =
      activeDate === "Tomorrow" ? "tomorrow"
      : activeDate === "Upcoming" ? "upcoming"
      : "today";
    result = result.filter((e) => daySlot(e) === slot);
    return result;
  }, [eventsData, activeCategory, activeNeighborhood, activeDate, searchQuery, today, tomorrow]);

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
              { id: "upcoming", label: "Upcoming" },
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
        {/* Count badge — only once events have actually arrived (isPending
            false), otherwise it would flash "0 events" during the fetch (or
            the cache-restore pause on refresh) before any are counted. */}
        {!eventsPending && (
          <div className="absolute top-2 right-2 z-[9999] bg-black/70 text-white text-xs px-2 py-1 font-mono pointer-events-none">
            {filtered.length} {filtered.length === 1 ? "event" : "events"} {dayTab}
          </div>
        )}
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
          onVenueClick={(id) => navigate(`/bar/${id}`)}
        />
        {/* Loading / venue-gap overlay — covers the moment between events
            arriving and venues arriving (race), and persists if the venues
            fetch failed entirely. Without this, the map looks empty even
            though the badge says "19 events tonight", which reads as a
            bug rather than a loading state. */}
        {showOverlay && overlayPending && (
          <div className="absolute inset-0 z-[150] flex items-center justify-center bg-background/90 px-6 pointer-events-none">
            {venuesMissing ? (
              // Persistent error — shared ErrorState so the map speaks the same
              // error language as the rest of the app (calm card, no brutalist
              // offset shadow). pointer-events-auto re-enables the retry button
              // inside the otherwise click-through overlay.
              <div className="pointer-events-auto">
                <ErrorState
                  inline
                  title="Venues unavailable"
                  message="Couldn't load venue data. Check your connection and try again."
                  onRetry={() => { refetchVenues(); refetchEvents(); }}
                  isRetrying={venuesFetching}
                />
              </div>
            ) : (
              // Transient loading — calm centered spinner (with the shared
              // slow-connection hint after 5s), matching every other page.
              <Spinner size="lg" />
            )}
          </div>
        )}
      </div>

    </div>
  );
}
