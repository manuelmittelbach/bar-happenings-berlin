import { useState, useMemo, useCallback, useLayoutEffect, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { useIsMobile } from "@/hooks/use-mobile";
import { Search, Users, Map, SlidersHorizontal } from "lucide-react";
import { getEventBadge } from "@/lib/eventBadges";

import EventCard from "@/components/events/EventCard";
import { Spinner } from "@/components/ui/spinner";
import CategoryPill, { CategoryIconBar, CategoryIconRow } from "@/components/events/CategoryPill";


import type { BarlinEvent } from "@/types/event";
import { useEvents, useVenues, useHasEventsAfter, useCategories } from "@/hooks/useEvents";
import { useUserLocation } from "@/hooks/useUserLocation";
import { MapPin, X } from "lucide-react";
import { haversineMeters } from "@/lib/distance";
import { isEventStillOnline } from "@/lib/eventStatus";
import { berlinDateString, berlinDateStringOffset, berlinHour } from "@/lib/dateFormat";
import { useSessionState } from "@/lib/useSessionState";

const dateFilters = ["All", "Today", "Tomorrow"];
const entryFilters = ["All", "Free", "Pay what you want", "0-5 €", "0-10 €"];

const parseEntryEuro = (s: string): number | null => {
  const m = s.match(/^(\d+)(?:,(\d{1,2}))?\s*€$/);
  if (!m) return null;
  const whole = parseInt(m[1], 10);
  const frac = m[2] ? parseInt(m[2], 10) / Math.pow(10, m[2].length) : 0;
  return whole + frac;
};
export const EXPLORE_SCROLL_KEY = "inside-bars-explore-scroll-y";

export default function Index() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  // Shared keys with MapPage so filters carry across list/map views.
  const [searchQuery, setSearchQuery] = useSessionState("bhb-shared-search", "");
  const [activeCategory, setActiveCategory] = useSessionState(
    "bhb-shared-category",
    "",
    searchParams.get("category"),
  );
  const [activeNeighborhood, setActiveNeighborhood] = useSessionState("bhb-shared-neighborhood", "");
  const [activeDate, setActiveDate] = useSessionState(
    "bhb-shared-date",
    "All",
    searchParams.get("date"),
  );
  const [activeEntry, setActiveEntry] = useSessionState("bhb-shared-entry", "All");
  const [showFilters, setShowFilters] = useState(false);
  
  

  const categoryBarRef = useRef<HTMLDivElement>(null);
  const [stickyOffset, setStickyOffset] = useState(160); // fallback estimate
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [targetSection, setTargetSection] = useState<string | null>(null);

  useEffect(() => {
    const measure = () => {
      if (categoryBarRef.current) {
        // Header is sticky at top-0 with height ~58px; category bar sticky at top-[57px]
        setStickyOffset(57 + categoryBarRef.current.offsetHeight);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Find which time section is currently "active" at the sticky top position
  const getCurrentVisibleSection = useCallback((): string | null => {
    const threshold = stickyOffset + 5;
    let active: string | null = null;
    for (const [label, el] of Object.entries(sectionRefs.current)) {
      if (!el) continue;
      const { top, bottom } = el.getBoundingClientRect();
      if (top <= threshold && bottom > threshold) {
        active = label;
        break;
      }
    }
    return active;
  }, [stickyOffset]);

  // When switching category, preserve current time section
  const handleCategorySelect = useCallback((cat: string) => {
    const current = getCurrentVisibleSection();
    if (current) setTargetSection(current);
    setActiveCategory(cat);
  }, [getCurrentVisibleSection]);

  // After re-render, scroll to the preserved section
  useEffect(() => {
    if (!targetSection) return;
    const el = sectionRefs.current[targetSection];
    if (!el) { setTargetSection(null); return; }
    const top = el.getBoundingClientRect().top + window.scrollY - stickyOffset;
    window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
    setTargetSection(null);
  }, [targetSection, stickyOffset]);

  const location = useLocation();
  const isFirstMount = useRef(true);

  useEffect(() => {
    // Only apply URL params when they're actually present — empty/missing
    // params must NOT clobber the session-restored filter state on back
    // navigation (where the URL has no ?category/?date).
    const cat = searchParams.get("category");
    const date = searchParams.get("date");
    if (cat !== null) setActiveCategory(cat);
    if (date !== null) setActiveDate(date);
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = sectionRefs.current["__datefilter"];
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 57;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }));
  }, [location.key]);


  const today = berlinDateString();
  const tomorrow = berlinDateStringOffset(1);
  const yesterday = berlinDateStringOffset(-1);
  const cutoffDate = berlinDateStringOffset(30);
  const isLateNight = berlinHour() < 6;

  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const { data: eventsData = [], isLoading: eventsLoading, isFetching: eventsFetching } = useEvents(showAllUpcoming ? undefined : cutoffDate);
  const { data: hasMoreUpcoming = false } = useHasEventsAfter(cutoffDate, !showAllUpcoming);
  const { data: venuesData = [] } = useVenues();
  const { data: categoriesData = [] } = useCategories();
  const categories = useMemo(
    () => categoriesData.filter((c) => c.enabled).map((c) => c.label),
    [categoriesData],
  );

  const venueMap = useMemo(
    () => Object.fromEntries(venuesData.map((v) => [v.id, v])),
    [venuesData]
  );

  const { location: userLocation, status: locationStatus, request: requestLocation } = useUserLocation();
  const [locationBannerDismissed, setLocationBannerDismissed] = useState(false);
  const showLocationBanner = locationStatus === "idle" && !locationBannerDismissed;

  const filtered = useMemo(() => {
    let result = [...eventsData];

    result = result.filter((e) => isEventStillOnline(e));

    // Hide canceled events unless they're today or tomorrow — no reason to clutter
    // the listings with cancellations that happen far in advance.
    result = result.filter((e) => {
      if (e.status !== "canceled") return true;
      return e.date === today || e.date === tomorrow;
    });

    if (searchQuery) {
      result = result.filter(
        (e) => fuzzyMatchAny([e.venue], searchQuery)
      );
    }
    if (activeCategory) result = result.filter((e) => e.category === activeCategory);
    if (activeNeighborhood) result = result.filter((e) => e.neighborhood === activeNeighborhood);
    if (activeDate === "Today") result = result.filter((e) => e.date === today);
    if (activeDate === "Tomorrow") result = result.filter((e) => e.date === tomorrow);
    if (activeEntry === "Free") result = result.filter((e) => e.entryInfo === "Free");
    if (activeEntry === "Pay what you want") result = result.filter((e) =>
      e.entryInfo === "Pay what you want" || e.entryInfo === "Free"
    );
    if (activeEntry === "0-5 €") result = result.filter((e) => {
      if (e.entryInfo === "Free" || e.entryInfo === "Pay what you want") return true;
      const n = parseEntryEuro(e.entryInfo);
      return n !== null && n <= 5;
    });
    if (activeEntry === "0-10 €") result = result.filter((e) => {
      if (e.entryInfo === "Free" || e.entryInfo === "Pay what you want") return true;
      const n = parseEntryEuro(e.entryInfo);
      return n !== null && n <= 10;
    });

    const WALK_30MIN_M = 2400;

    const getEventDist = (e: typeof result[0]) => {
      if (!userLocation) return Infinity;
      const v = venueMap[e.venueId];
      return v?.lat && v?.lng ? haversineMeters(userLocation.lat, userLocation.lng, v.lat, v.lng) : Infinity;
    };

    // 0 = walking distance (top), 1 = normal, 2 = might be over, 3 = over (very bottom)
    // Walking-boost only applies to today/tomorrow — for "Later" events distance
    // matters less since users are planning, not deciding spontaneously.
    const getSortGroup = (e: typeof result[0], dist: number): number => {
      const label = getEventBadge(e, 0)?.label;
      if (label === "Over") return 3;
      if (label === "Might be over") return 2;
      const isNearTerm = e.date === today || e.date === tomorrow;
      if (isNearTerm && dist <= WALK_30MIN_M) return 0;
      return 1;
    };

    result.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;

      const dA = getEventDist(a);
      const dB = getEventDist(b);
      const groupA = getSortGroup(a, dA);
      const groupB = getSortGroup(b, dB);

      if (groupA !== groupB) return groupA - groupB;
      if (groupA === 0) return dA - dB; // walking distance: nearest first
      return a.startTime.localeCompare(b.startTime);
    });

    return result;
  }, [searchQuery, activeCategory, activeNeighborhood, activeDate, activeEntry, today, tomorrow, yesterday, isLateNight, userLocation, eventsData, venueMap]);

  // Filter dropdown shows only neighborhoods that actually have events — avoids
  // empty filter clicks. Derived from currently loaded events; refreshes when
  // the user clicks "Show more events" and more data flows in.
  const availableNeighborhoods = useMemo(() => {
    const set = new Set<string>();
    for (const e of eventsData) {
      if (e.neighborhood && e.neighborhood.trim()) set.add(e.neighborhood);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
  }, [eventsData]);

  useLayoutEffect(() => {
    if (sessionStorage.getItem("inside-bars-scroll-to-filter") === "1") {
      sessionStorage.removeItem("inside-bars-scroll-to-filter");
      const scrollToFilter = () => {
        const el = document.getElementById("date-filter-bar");
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY - 56;
        window.scrollTo({ top: Math.max(0, top), left: 0, behavior: "auto" });
      };
      const f1 = requestAnimationFrame(() => {
        scrollToFilter();
        const f2 = requestAnimationFrame(scrollToFilter);
        return () => cancelAnimationFrame(f2);
      });
      return () => cancelAnimationFrame(f1);
    }

    const savedScrollY = sessionStorage.getItem(EXPLORE_SCROLL_KEY);
    if (!savedScrollY) return;

    const scrollY = Number(savedScrollY);
    sessionStorage.removeItem(EXPLORE_SCROLL_KEY);

    const firstFrame = requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
      const secondFrame = requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
      });

      return () => cancelAnimationFrame(secondFrame);
    });

    return () => cancelAnimationFrame(firstFrame);
  }, []);

  const handleEventClick = useCallback((eventId: string) => {
    sessionStorage.setItem(EXPLORE_SCROLL_KEY, String(window.scrollY));
    navigate(`/event/${eventId}`);
  }, [navigate]);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: { label: string; type: "bar" }[] = [];
    const seen = new Set<string>();
    for (const v of venuesData) {
      if (v.name.toLowerCase().includes(q) && !seen.has(v.name)) {
        seen.add(v.name);
        results.push({ label: v.name, type: "bar" });
      }
    }
    return results.slice(0, 2);
  }, [searchQuery, venuesData]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <>
        <section className="border-b-2 border-foreground bg-muted/40">
          <div className="container py-12 md:py-16 lg:py-20 relative z-[45]">
            <div>
              <p className="mono-label text-accent mb-4">Berlin's independent bar guide</p>
              <h1 className="heading-display text-5xl md:text-7xl lg:text-8xl leading-[0.95] max-w-4xl">
                What's on
                <br />
                <span className="heading-editorial lowercase italic">tonight</span>
                <br />
                in Berlin bars?
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-lg leading-relaxed">
                Live music, quiz nights, open mics, and community events in small independent bars across the city.
              </p>
            </div>

            {/* Location permission primer */}
            {showLocationBanner && (
              <div className="mt-10 max-w-lg flex items-center gap-3 px-4 py-3 border border-border bg-background/80 backdrop-blur-sm">
                <MapPin className="h-4 w-4 text-accent shrink-0" />
                <p className="text-sm text-muted-foreground flex-1">
                  <button
                    onClick={() => requestLocation()}
                    className="text-foreground font-semibold underline underline-offset-2 hover:text-accent transition-colors"
                  >
                        Show nearby events first
                  </button>
                  {" "}— uses your location to sort
                </p>
                <button
                  onClick={() => setLocationBannerDismissed(true)}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

          </div>
        </section>

        {/* Date filter bar — Map-style with thick black border */}
        <div id="date-filter-bar" ref={(el) => { sectionRefs.current["__datefilter"] = el; }} style={{ scrollMarginTop: 56 }} className="bg-background border-b border-border">
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
            {(() => {
              const activeFilterCount =
                (searchQuery.trim() ? 1 : 0) +
                (activeNeighborhood ? 1 : 0) +
                (activeEntry !== "All" ? 1 : 0);
              return (
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
              );
            })()}
          </div>
        </div>

        {showFilters && (
          <div className="border-b-2 border-foreground bg-background">
            <div className="container py-5 space-y-5">
              <div>
                <label className="mono-label text-muted-foreground mb-2 block">Search</label>
                <div className="relative max-w-lg" ref={searchWrapperRef}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search by bar"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={(e) => { if (e.key === "Escape") setShowSuggestions(false); }}
                    className="w-full h-12 pl-10 pr-4 bg-background border-2 border-foreground text-sm font-mono placeholder:text-muted-foreground outline-none transition-colors"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-[60] border-2 border-foreground border-t-0 bg-background">
                      {suggestions.map((s) => (
                        <button
                          key={s.label}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSearchQuery(s.label);
                            setShowSuggestions(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left border-b border-border last:border-b-0"
                        >
                          <span className="text-sm font-body truncate">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="mono-label text-muted-foreground mb-2 block">Neighborhood</label>
                <div className="flex flex-wrap gap-2">
                  <CategoryPill label="All" active={!activeNeighborhood} onClick={() => setActiveNeighborhood("")} />
                  {availableNeighborhoods.map((n) => (
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

        {/* Sticky category bar */}
        <div ref={categoryBarRef} className="sticky top-[57px] z-40 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="container py-3">
            {/* Mobile: icon scroller */}
            <div className="md:hidden">
              <CategoryIconBar
                categories={categories}
                activeCategory={activeCategory}
                onSelect={handleCategorySelect}
              />
            </div>
            {/* Desktop: icon row */}
            <div className="hidden md:block">
              <CategoryIconRow
                categories={categories}
                activeCategory={activeCategory}
                onSelect={handleCategorySelect}
              />
            </div>
          </div>
        </div>

        {eventsLoading ? (
          <section className="bg-background">
            <div className="container py-24">
              <div className="flex justify-center">
                <Spinner />
              </div>
            </div>
          </section>
        ) : (
          <>
            {(() => {
              type SectionLayout = "grid-4" | "grid-2" | "list";
              const sections: { label: string; events: typeof filtered; layout: SectionLayout }[] = [];
        
              if (activeDate === "Today") {
                sections.push({ label: "Today", events: filtered, layout: "grid-2" });
              } else if (activeDate === "Tomorrow") {
                sections.push({ label: "Tomorrow", events: filtered, layout: "grid-2" });
              } else {
                const yesterdayEvents = isLateNight ? filtered.filter((e) => e.date === yesterday) : [];
                const todayEvents = filtered.filter((e) => e.date === today);
                const tomorrowEvents = filtered.filter((e) => e.date === tomorrow);
                const laterEvents = filtered.filter((e) => e.date > tomorrow);
        
                if (isLateNight) sections.push({ label: "Yesterday", events: yesterdayEvents, layout: "grid-2" });
                sections.push({ label: "Today", events: todayEvents, layout: "grid-2" });
                sections.push({ label: "Tomorrow", events: tomorrowEvents, layout: "grid-2" });
                sections.push({ label: "Later", events: laterEvents, layout: "list" });
              }
        
              const formatDaySeparator = (dateStr: string) => {
                const d = new Date(dateStr + "T00:00:00");
                return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
              };
        
              const groupByDate = (evts: BarlinEvent[]) => {
                const groups: { date: string; events: BarlinEvent[] }[] = [];
                evts.forEach((e) => {
                  const last = groups[groups.length - 1];
                  if (last && last.date === e.date) {
                    last.events.push(e);
                  } else {
                    groups.push({ date: e.date, events: [e] });
                  }
                });
                return groups;
              };
        
              const CompactRow = ({ event }: { event: BarlinEvent }) => {
                const hash = event.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
                const interested = (hash % 42) + 1;
                const rowBadge = getEventBadge(event, interested);

                return (
                  <button
                    onClick={() => handleEventClick(event.id)}
                    className={`w-full flex flex-col gap-0.5 py-3.5 px-4 hover:bg-muted/50 transition-colors text-left group ${rowBadge?.label === "Might be over" || rowBadge?.label === "Over" ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`shrink-0 font-mono text-[11px] uppercase tracking-wider w-[52px] ${event.startTime ? "text-accent" : "text-muted-foreground"}`}>
                        {event.startTime || "—"}
                      </span>
                      <span className="font-body font-bold text-sm group-hover:text-accent transition-colors truncate min-w-0">
                        {cleanEventTitle(event.title, event.venue)}
                      </span>
                      {rowBadge && (
                        <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-body font-bold uppercase tracking-wide ${
                          rowBadge.variant === "popular"
                            ? "border border-accent/40 text-accent bg-accent/10"
                            : "bg-muted text-foreground border border-border"
                        }`}>
                          <rowBadge.icon className="h-2.5 w-2.5" />
                          {rowBadge.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pl-[60px]">
                      <span className="text-xs text-muted-foreground font-mono truncate">
                        {event.venue} · {event.neighborhood}
                      </span>
                    </div>
                  </button>
                );
              };
        
              const sectionBgs = ["bg-background", "bg-background", "bg-background", "bg-background", "bg-background"];
        
              return sections.map((section, si) => (
                <section
                  key={section.label}
                  ref={(el) => { sectionRefs.current[section.label] = el; }}
                  className={`${sectionBgs[si % sectionBgs.length]} ${si > 0 ? "border-t border-border" : ""}`}
                >
                  <div className="sticky z-30 bg-background/95 backdrop-blur-sm border-b border-border" style={{ top: stickyOffset }}>
                    <div className="container flex items-center justify-between h-11">
                      <h2 className="font-heading text-xl font-extrabold uppercase tracking-tight">{section.label}</h2>
                      <span className="mono-label text-muted-foreground">{section.events.length} events found</span>
                    </div>
                  </div>
        
                  <div className="container py-8">
                    {section.events.length === 0 ? (
                      <p className="font-mono text-xs text-muted-foreground py-2">No events</p>
                    ) : section.layout === "list" ? (
                      <div className="space-y-6">
                        {groupByDate(section.events).map((group) => (
                          <div key={group.date} className="border-2 border-border bg-background">
                            <div className="sticky z-20 flex items-center gap-3 px-4 py-3 bg-muted/60 backdrop-blur-sm border-b-2 border-border" style={{ top: stickyOffset + 46 }}>
                              <span className="font-heading text-sm font-extrabold uppercase tracking-tight">
                                {formatDaySeparator(group.date)}
                              </span>
                            </div>
                            <div className="divide-y divide-border/50">
                              {group.events.map((event) => (
                                <CompactRow key={event.id} event={event} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-6">
                        {section.events.map((event, i) => (
                          <EventCard key={event.id} event={event} index={i} onClick={handleEventClick} />
                        ))}
                      </div>
                    )}
                    {section.label === "Later" && hasMoreUpcoming && !showAllUpcoming && (
                      <div className="flex justify-center pt-8">
                        <button
                          onClick={() => setShowAllUpcoming(true)}
                          disabled={eventsFetching}
                          className="font-mono font-bold text-xs uppercase tracking-wider px-6 py-3 border-2 border-border hover:border-accent hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {eventsFetching ? "Loading…" : "Show more events"}
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              ));
            })()}
          </>
        )}

      {/* Map button */}
      <button
        onClick={() => {
          sessionStorage.setItem(EXPLORE_SCROLL_KEY, String(window.scrollY));
          navigate("/map");
        }}
        className="fixed bottom-6 right-0 z-[9999] flex items-center gap-2 h-12 pl-5 pr-4 bg-accent text-accent-foreground font-mono font-bold text-xs uppercase tracking-wider shadow-lg hover:bg-accent/90 transition-all rounded-l-full border-2 border-r-0 border-accent"
      >
        <Map className="h-4 w-4" />
        Map
      </button>
    </>
  );
}
