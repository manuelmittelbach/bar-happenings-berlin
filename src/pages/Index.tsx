import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { useIsMobile } from "@/hooks/use-mobile";
import { Search, Map, SlidersHorizontal, X } from "lucide-react";
import { getEventBadge } from "@/lib/eventBadges";

import EventCard from "@/components/events/EventCard";
import { PageSpinner } from "@/components/ui/page-spinner";
import CategoryPill, { CategoryIconBar, CategoryIconRow } from "@/components/events/CategoryPill";
import { Slider } from "@/components/ui/slider";
import TonightsHighlights from "@/components/events/TonightsHighlights";
import WalkingDistanceSection from "@/components/events/WalkingDistanceSection";
import FreeTonightStrip from "@/components/events/FreeTonightStrip";


import type { BarlinEvent } from "@/types/event";
import { useEvents, useVenues, useCategories } from "@/hooks/useEvents";
import { isEventStillOnline } from "@/lib/eventStatus";
import { berlinDateString, berlinDateStringOffset, berlinHour } from "@/lib/dateFormat";
import { useFilterParams } from "@/lib/useFilterParams";
import { isFreeEntry, isPayWhatYouWantEntry, parseEntryEuro } from "@/lib/entryInfo";

const formatEntryLabel = (v: number) =>
  v === 0 ? "Free" : v >= 20 ? "Any price" : `Up to ${v} €`;

export const EXPLORE_SCROLL_KEY = "inside-bars-explore-scroll-y";

// Module-level flag: hero animation runs only on the first mount per page-load.
// Internal navigation (Header/Footer "Inside Bars" links) re-mounts Index but skips it.
// Hard refresh reloads the module → flag resets → animation plays again.
let heroAnimationPlayed = false;

export default function Index() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const {
    searchQuery, setSearchQuery,
    activeCategory, setActiveCategory,
    activeNeighborhood, setActiveNeighborhood,
    activeDate,
    activeEntry, setActiveEntry,
  } = useFilterParams();
  const [showFilters, setShowFilters] = useState(false);
  const [animateHero] = useState(() => !heroAnimationPlayed);
  useEffect(() => {
    if (animateHero) heroAnimationPlayed = true;
  }, [animateHero]);
  
  

  const categoryBarRef = useRef<HTMLDivElement>(null);
  const [stickyOffset, setStickyOffset] = useState(160); // fallback estimate
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  // Captured in handleCategorySelect, consumed by the layout-effect after the
  // category change has rendered. Ref (not state) so a split render between
  // setTargetSection and setActiveCategory can't fire the scroll early.
  const targetSectionRef = useRef<string | null>(null);

  useEffect(() => {
    const el = categoryBarRef.current;
    if (!el) return;
    const measure = () => {
      // Header is sticky at top-0 with height ~58px; category bar sticky at top-[57px]
      setStickyOffset(57 + el.offsetHeight);
    };
    measure();
    // ResizeObserver catches category-bar height changes that fire after mount
    // (categories loading async, font swaps, content wraps), which window
    // resize alone misses — that's why TODAY/TOMORROW labels were clipping
    // under a stale stickyOffset.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Find which time section the user is currently scrolled to (the one whose
  // sticky header is glued just below the categories bar). Walks sections in
  // render order and picks the LAST whose top has crossed the threshold.
  const getCurrentVisibleSection = useCallback((): string | null => {
    const threshold = stickyOffset + 5;
    let active: string | null = null;
    for (const [label, el] of Object.entries(sectionRefs.current)) {
      if (label === "__datefilter") continue;
      if (!el) continue;
      const { top } = el.getBoundingClientRect();
      if (top <= threshold) active = label;
    }
    return active;
  }, [stickyOffset]);

  // When switching category, capture the current section and let the
  // layout-effect below restore it after the category-change re-render.
  const handleCategorySelect = useCallback((cat: string) => {
    targetSectionRef.current = getCurrentVisibleSection();
    setActiveCategory(cat);
  }, [getCurrentVisibleSection, setActiveCategory]);

  // After the category change has rendered the new sections, scroll back to
  // the section the user was on. useLayoutEffect runs synchronously after the
  // DOM commit so there's no flash of wrong scroll position.
  useLayoutEffect(() => {
    const target = targetSectionRef.current;
    if (!target) return;
    targetSectionRef.current = null;
    const el = sectionRefs.current[target];
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - stickyOffset;
    window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
  }, [activeCategory, stickyOffset]);

  const location = useLocation();
  const isFirstMount = useRef(true);

  // Scroll to the date filter on real navigations to this page (pathname change),
  // but NOT on filter updates that only change ?search params — otherwise every
  // filter click bounces the page.
  useEffect(() => {
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
  }, [location.pathname]);


  const today = berlinDateString();
  const tomorrow = berlinDateStringOffset(1);
  const yesterday = berlinDateStringOffset(-1);
  const cutoffDate = berlinDateStringOffset(30);
  const isLateNight = berlinHour() < 6;

  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const { data: eventsData = [], isLoading: eventsLoading } = useEvents();
  const { data: venuesData = [] } = useVenues();
  const { data: categoriesData = [] } = useCategories();
  // Slug-IDs (categories.id) — passed to CategoryPill and used as activeCategory value.
  const categories = useMemo(
    () => categoriesData.filter((c) => c.enabled).map((c) => c.id),
    [categoriesData],
  );

  // Data slices for the editorial homepage sections. Each is a thin filter
  // over the raw events list — they intentionally ignore the user's
  // category/neighborhood/entry filters so the "Tonight's Highlights"
  // banner stays curated rather than personalized.
  const todayEvents = useMemo(
    () => eventsData.filter((e) => e.date === today && isEventStillOnline(e) && e.status !== "canceled"),
    [eventsData, today],
  );
  const highlightedTonightEvents = useMemo(
    () => todayEvents.filter((e) => e.isHighlight),
    [todayEvents],
  );

  // Editorial sections only render in the default landing state (activeDate = "All").
  // Once the user picks Today or Tomorrow, the page becomes a focused list —
  // the magazine furniture would compete with their narrowed intent.
  const showEditorialSections = activeDate === "All";

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
    if (activeEntry < 20) {
      result = result.filter((e) => {
        if (isFreeEntry(e.entryInfo) || isPayWhatYouWantEntry(e.entryInfo)) return true;
        if (activeEntry === 0) return false;
        const n = parseEntryEuro(e.entryInfo);
        return n !== null && n <= activeEntry;
      });
    }

    // Sort group keeps "Over" events at the bottom and "Might be over" just
    // above. Within an active group, sort by date then start_time. The
    // dedicated WalkingDistance section handles "near you" — we no longer
    // re-rank the main list by distance, so the order here is fully
    // chronological + status-aware (predictable for the user).
    const getSortGroup = (e: typeof result[0]): number => {
      const label = getEventBadge(e)?.label;
      if (label === "Over") return 3;
      if (label === "Might be over") return 2;
      return 1;
    };

    result.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;

      const groupA = getSortGroup(a);
      const groupB = getSortGroup(b);
      if (groupA !== groupB) return groupA - groupB;

      // Events ohne Startzeit ans Ende sortieren — sonst landen sie vor allen
      // Zeit-Events, weil "" lexikographisch < "20:00" ist.
      const tA = a.startTime || "99:99";
      const tB = b.startTime || "99:99";
      return tA.localeCompare(tB);
    });

    return result;
  }, [searchQuery, activeCategory, activeNeighborhood, activeDate, activeEntry, today, tomorrow, eventsData]);

  // True when there are filtered events past the 30-day cutoff. Recomputed on
  // every filter change so the "Show more events" button only appears when the
  // current filter actually has events further out.
  const hasMoreUpcoming = useMemo(
    () => filtered.some((e) => e.date > cutoffDate),
    [filtered, cutoffDate],
  );

  // Filter dropdown shows only neighborhoods that actually have events — avoids
  // empty filter clicks.
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
      // Re-scroll across several frames + timeouts because layout above the
      // filter can shift after the initial scroll: the location banner can
      // disappear when useUserLocation flips status from idle→loading in a
      // post-mount useEffect, fonts swap in, dvh changes on mobile.
      // scrollIntoView respects the element's scrollMarginTop: 56.
      const scrollToFilter = () => {
        document.getElementById("date-filter-bar")?.scrollIntoView({
          block: "start",
          behavior: "auto",
        });
      };
      const rafs: number[] = [];
      const timeouts: number[] = [];
      rafs.push(requestAnimationFrame(() => {
        scrollToFilter();
        rafs.push(requestAnimationFrame(scrollToFilter));
      }));
      timeouts.push(window.setTimeout(scrollToFilter, 100));
      timeouts.push(window.setTimeout(scrollToFilter, 300));
      return () => {
        rafs.forEach(cancelAnimationFrame);
        timeouts.forEach(clearTimeout);
      };
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

  // Compact magazine-masthead hero.
  // Heading is shortened to "What's on tonight?" — the deck below tells
  // the user what kinds of events the site covers, so we don't need to
  // repeat "in Berlin bars" in the H1.

  return (
    <>
        <section className="relative overflow-x-clip border-b-2 border-foreground bg-muted/40 flex flex-col justify-center py-14 md:py-20 min-h-[480px] md:min-h-[560px]">
          <div className="container relative z-[45]">
            <motion.p
              className="mono-label text-accent mb-4"
              initial={animateHero ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0 }}
            >
              Berlin's independent bar guide
            </motion.p>

            <h1 className="heading-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[0.95] mb-5 md:mb-6">
              {/* Erste Zeile: "What's on" — block forciert Umbruch vor
                  "tonight", egal wie breit der Container ist. */}
              <span className="block">
                <motion.span
                  className="inline-block"
                  initial={animateHero ? { opacity: 0, y: 20 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  What's on
                </motion.span>
              </span>
              {/* Zweite Zeile: italic "tonight" + accent "?" */}
              <span className="block">
                <motion.span
                  className="heading-editorial lowercase italic inline-block"
                  initial={animateHero ? { opacity: 0, y: 20 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.25 }}
                >
                  tonight
                </motion.span>
                <motion.span
                  className="inline-block text-accent"
                  initial={animateHero ? { opacity: 0, y: 20 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                >
                  ?
                </motion.span>
              </span>
            </h1>

            <motion.p
              className="font-body text-base md:text-lg text-foreground/80 max-w-xl leading-relaxed"
              initial={animateHero ? { opacity: 0, y: 10 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.55 }}
            >
              Find live music, quiz nights, open mics, and community events
              in small independent bars across Berlin.
            </motion.p>
          </div>
        </section>

        {/* Editorial homepage sections — only rendered in the default landing
            state (activeDate = "All"). These sit between hero and filter bar
            and act as the magazine "above the fold" for tonight. */}
        {showEditorialSections && (
          <>
            <TonightsHighlights
              events={highlightedTonightEvents}
              categories={categoriesData}
              onEventClick={handleEventClick}
            />
            <WalkingDistanceSection
              events={todayEvents}
              categories={categoriesData}
              onEventClick={handleEventClick}
            />
            <FreeTonightStrip
              events={todayEvents}
              categories={categoriesData}
              onEventClick={handleEventClick}
            />
          </>
        )}

        {/* Filter bar — only the Filters drawer toggle remains here. The
            All/Today/Tomorrow date buttons live on the Map page only; on
            Index the editorial sections frame "tonight" naturally so the
            extra control would be redundant. setActiveDate is still kept
            in useFilterParams because the URL state is shared with /map. */}
        <div id="date-filter-bar" ref={(el) => { sectionRefs.current["__datefilter"] = el; }} style={{ scrollMarginTop: 58 }} className="bg-background border-b border-border">
          <div className="container flex items-center gap-2 py-2.5">
            {(() => {
              const activeFilterCount =
                (searchQuery.trim() ? 1 : 0) +
                (activeNeighborhood ? 1 : 0) +
                (activeEntry < 20 ? 1 : 0);
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
                    className="w-full h-12 pl-10 pr-10 bg-background border-2 border-foreground text-sm font-mono placeholder:text-muted-foreground outline-none transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => { setSearchQuery(""); setShowSuggestions(false); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-7 w-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-[60] border-2 border-foreground border-t-0 bg-background">
                      {suggestions.map((s) => (
                        <button
                          key={s.label}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
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
          <PageSpinner />
        ) : (
          <>
            {(() => {
              type SectionLayout = "grid-4" | "grid-2" | "list";
              const sections: { label: string; events: typeof filtered; layout: SectionLayout }[] = [];
        
              if (activeDate === "Today") {
                sections.push({ label: "All Tonight", events: filtered, layout: "grid-2" });
              } else if (activeDate === "Tomorrow") {
                sections.push({ label: "Tomorrow", events: filtered, layout: "grid-2" });
              } else {
                const yesterdayEvents = isLateNight ? filtered.filter((e) => e.date === yesterday) : [];
                const todayEvents = filtered.filter((e) => e.date === today);
                const tomorrowEvents = filtered.filter((e) => e.date === tomorrow);
                const laterEvents = filtered.filter(
                  (e) => e.date > tomorrow && (showAllUpcoming || e.date <= cutoffDate),
                );

                if (isLateNight) sections.push({ label: "Yesterday", events: yesterdayEvents, layout: "grid-2" });
                sections.push({ label: "All Tonight", events: todayEvents, layout: "grid-2" });
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
                const rowBadge = getEventBadge(event);
                const catInfo = categoriesData.find((c) => c.id === event.category);
                const catColor = catInfo?.color;
                const catLabel = catInfo?.label ?? event.category;

                // Badge chip styles per variant — kept inline here because
                // CompactRow renders only inside Index.tsx. EventCard has its
                // own copy of this map (same shape).
                const rowBadgeChipClass = rowBadge && (
                  rowBadge.variant === "popular"
                    ? "border border-accent/40 text-accent bg-accent/10"
                    : "bg-muted text-foreground border border-border"
                );

                return (
                  <button
                    onClick={() => handleEventClick(event.id)}
                    className={`w-full flex flex-col gap-0.5 py-3.5 px-4 hover:bg-muted/50 transition-colors text-left group ${rowBadge?.label === "Might be over" || rowBadge?.label === "Over" ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-body font-bold text-sm group-hover:text-accent transition-colors truncate min-w-0 flex-1">
                        {cleanEventTitle(event.title, event.venue)}
                      </span>
                      {rowBadge && (
                        <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-body font-bold uppercase tracking-wide ${rowBadgeChipClass}`}>
                          <rowBadge.icon className="h-2.5 w-2.5" />
                          {rowBadge.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono truncate">
                        {event.category && (
                          <>
                            <span className="font-bold" style={catColor ? { color: catColor } : undefined}>
                              {catLabel}
                            </span>
                            <span className="text-muted-foreground"> · </span>
                          </>
                        )}
                        <span className="text-muted-foreground">{event.venue}</span>
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
                  // Last section gets a dynamic min-height so any earlier
                  // section can be scrolled to the sticky top, even when the
                  // current filter only leaves a handful of events. With many
                  // events the natural content height exceeds the min — no
                  // padding visible.
                  style={si === sections.length - 1 ? { minHeight: `calc(100dvh - ${stickyOffset}px)` } : undefined}
                  className={`${sectionBgs[si % sectionBgs.length]} ${si > 0 ? "border-t border-border" : ""}`}
                >
                  <div className="sticky z-30 bg-background/95 backdrop-blur-sm border-b border-border" style={{ top: stickyOffset }}>
                    <div className="container flex items-center justify-between h-11">
                      <h2 className="font-heading text-xl font-extrabold uppercase tracking-tight">{section.label}</h2>
                      <span className="mono-label text-muted-foreground">{section.events.length} {section.events.length === 1 ? "event" : "events"} found</span>
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
                          className="font-mono font-bold text-xs uppercase tracking-wider px-6 py-3 border-2 border-border hover:border-accent hover:text-accent transition-colors"
                        >
                          Show more events
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
          navigate({ pathname: "/map", search: location.search });
        }}
        className="fixed bottom-6 right-0 z-[9999] flex items-center gap-2 h-12 pl-5 pr-4 bg-accent text-accent-foreground font-mono font-bold text-xs uppercase tracking-wider shadow-lg hover:bg-accent/90 transition-all rounded-l-full border-2 border-r-0 border-accent"
      >
        <Map className="h-4 w-4" />
        Map
      </button>
    </>
  );
}
