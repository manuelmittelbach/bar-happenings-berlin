import { useState, useMemo, useCallback, useLayoutEffect, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Search, Users } from "lucide-react";
import { getEventBadge } from "@/lib/eventBadges";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import EventCard from "@/components/events/EventCard";
import CategoryPill, { CategoryIconBar, CategoryIconRow } from "@/components/events/CategoryPill";


import { events, categories, neighborhoods, venues, getCategoryInfoByLabel, getVenueById } from "@/data/mockData";
import type { BarlinEvent } from "@/data/mockData";
import { useUserLocation } from "@/hooks/useUserLocation";
import { haversineMeters } from "@/lib/distance";

const dateFilters = ["All", "Today", "Tomorrow", "This Week"];
const entryFilters = ["All", "Free Entry", "Pay at Venue"];
const EXPLORE_SCROLL_KEY = "inside-bars-explore-scroll-y";

export default function Index() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  
  const [activeCategory, setActiveCategory] = useState("");
  const [activeNeighborhood, setActiveNeighborhood] = useState("");
  const [activeDate, setActiveDate] = useState("All");
  const [activeEntry, setActiveEntry] = useState("All");
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

  const userLocation = useUserLocation();
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
    if (activeNeighborhood) result = result.filter((e) => e.neighborhood === activeNeighborhood);
    if (activeDate === "Today") result = result.filter((e) => e.date === today);
    if (activeDate === "Tomorrow") result = result.filter((e) => e.date === tomorrow);
    if (activeDate === "This Week") {
      const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
      result = result.filter((e) => e.date >= today && e.date <= weekEnd);
    }
    if (activeEntry === "Free Entry") result = result.filter((e) => /free/i.test(e.price));
    if (activeEntry === "Pay at Venue") result = result.filter((e) => !/free/i.test(e.price));

    result.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      if (userLocation) {
        const vA = getVenueById(a.venueId);
        const vB = getVenueById(b.venueId);
        if (vA?.lat && vB?.lat) {
          const dA = haversineMeters(userLocation.lat, userLocation.lng, vA.lat, vA.lng);
          const dB = haversineMeters(userLocation.lat, userLocation.lng, vB.lat, vB.lng);
          return dA - dB;
        }
      }
      return a.startTime.localeCompare(b.startTime);
    });

    const seen = new Set<string>();
    result = result.filter((e) => {
      if (seen.has(e.parentId)) return false;
      seen.add(e.parentId);
      return true;
    });

    return result;
  }, [searchQuery, activeCategory, activeNeighborhood, activeDate, activeEntry, today, tomorrow, userLocation]);

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

  useLayoutEffect(() => {
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
    const results: { label: string; type: "bar" | "neighborhood" }[] = [];
    const seen = new Set<string>();
    for (const n of neighborhoods) {
      if (n.toLowerCase().includes(q) && !seen.has(n)) {
        seen.add(n);
        results.push({ label: n, type: "neighborhood" });
      }
    }
    for (const v of venues) {
      if (v.name.toLowerCase().includes(q) && !seen.has(v.name)) {
        seen.add(v.name);
        results.push({ label: v.name, type: "bar" });
      }
    }
    return results.slice(0, 2);
  }, [searchQuery]);

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
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <section className="border-b-2 border-foreground noise-bg bg-muted/40">
          <div className="container py-12 md:py-16 lg:py-20 relative z-[45]">
            <div>
              <p className="mono-label text-accent mb-4">Berlin's independent bar guide</p>
              <h1 className="heading-display text-5xl md:text-7xl lg:text-8xl leading-[0.95] max-w-4xl">
                What's on
                <br />
                <span className="heading-editorial lowercase italic">tonight</span>
                <br />
                in Berlin bars
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-lg leading-relaxed">
                Live music, quiz nights, open mics, and community events in small independent bars across the city.
              </p>
            </div>

            <div className="mt-10 max-w-lg">
              <div className="relative" ref={searchWrapperRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by neighborhood or bar"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={(e) => { if (e.key === "Escape") setShowSuggestions(false); }}
                  className="w-full h-12 pl-10 pr-4 bg-background border-2 border-foreground text-sm font-mono placeholder:text-muted-foreground outline-none focus:bg-muted transition-colors"
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
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground w-20 shrink-0">
                          {s.type === "bar" ? "Bar" : "Area"}
                        </span>
                        <span className="text-sm font-body truncate">{s.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Filters row — all aligned left */}
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                {dateFilters.map((d) => (
                  <button
                    key={d}
                    onClick={() => setActiveDate(d)}
                    className={`inline-flex items-center justify-center px-4 py-2 font-mono text-[10px] md:text-xs uppercase tracking-wider border-2 transition-all ${
                      activeDate === d
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground hover:bg-foreground hover:text-background"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {showFilters && (
          <div className="border-b-2 border-foreground bg-card">
            <div className="container py-5 space-y-5">
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

        {/* Results count */}
        <div className="bg-background border-b border-border">
          <div className="container py-4">
            <p className="mono-label text-muted-foreground">{filtered.length} events found</p>
          </div>
        </div>

        {activeDate !== "All" && filtered.length === 0 ? (
          <section className="bg-background">
            <div className="container py-20">
              <div className="text-center py-20 border-2 border-border">
                <p className="font-heading text-lg font-bold uppercase">No events found</p>
                <p className="text-sm text-muted-foreground mt-1 font-mono">Try adjusting your filters</p>
              </div>
            </div>
          </section>
        ) : (
          <>
            {(() => {
              const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
              const monthEnd = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

              type SectionLayout = "grid-4" | "grid-2" | "list";
              const sections: { label: string; events: typeof filtered; layout: SectionLayout }[] = [];

              // When a specific date filter is active, show a single section
              if (activeDate === "Today") {
                if (filtered.length) sections.push({ label: "Today", events: filtered, layout: "grid-2" });
              } else if (activeDate === "Tomorrow") {
                if (filtered.length) sections.push({ label: "Tomorrow", events: filtered, layout: "grid-2" });
              } else if (activeDate === "This Week") {
                if (filtered.length) sections.push({ label: "This week", events: filtered, layout: "list" });
              } else {
                // "All" — split into temporal sections
                const todayEvents = filtered.filter((e) => e.date === today);
                const tomorrowEvents = filtered.filter((e) => e.date === tomorrow);
                const thisWeekEvents = filtered.filter((e) => e.date > tomorrow && e.date <= weekEnd);
                const laterEvents = filtered.filter((e) => e.date > weekEnd && e.date <= monthEnd);
                const evenLaterEvents = filtered.filter((e) => e.date > monthEnd);

                sections.push({ label: "Today", events: todayEvents, layout: "grid-2" });
                sections.push({ label: "Tomorrow", events: tomorrowEvents, layout: "grid-2" });
                sections.push({ label: "This week", events: thisWeekEvents, layout: "list" });
                sections.push({ label: "This month", events: laterEvents, layout: "list" });
                sections.push({ label: "Later", events: evenLaterEvents, layout: "list" });
              }

              const formatDatePill = (dateStr: string) => {
                const d = new Date(dateStr + "T00:00:00");
                return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
              };

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
                const isPopular = interested > 30;
                const rowBadge = getEventBadge(event, interested);
                const isLive = rowBadge?.variant === "live";
                return (
                  <button
                    onClick={() => handleEventClick(event.id)}
                    className={`w-full flex flex-col gap-0.5 py-3.5 px-4 hover:bg-muted/50 transition-colors text-left group ${isLive ? "bg-[hsl(0,72%,51%)]/[0.04] shadow-[inset_4px_0_0_hsl(0,72%,51%)]" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 font-mono text-[11px] text-accent uppercase tracking-wider w-[52px]">
                        {event.startTime}
                      </span>
                      <span className="font-body font-bold text-sm group-hover:text-accent transition-colors truncate min-w-0">
                        {cleanEventTitle(event.title, event.venue)}
                      </span>
                      {rowBadge && (
                        <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-body font-bold uppercase tracking-wide ${
                          rowBadge.variant === "live"
                            ? "bg-[hsl(0,72%,51%)] text-white animate-pulse"
                            : rowBadge.variant === "popular"
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
                      {interested > 5 && (
                        <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-mono ${isPopular ? "text-accent" : "text-muted-foreground"}`}>
                          <Users className="h-3 w-3" />
                          {interested}
                        </span>
                      )}
                    </div>
                  </button>
                );
              };

              const sectionBgs = ["bg-background", "bg-card", "bg-background", "bg-card", "bg-background"];

              return sections.map((section, si) => (
                <section
                  key={section.label}
                  ref={(el) => { sectionRefs.current[section.label] = el; }}
                  className={`${sectionBgs[si % sectionBgs.length]} ${si > 0 ? "border-t border-border" : ""}`}
                >
                  {/* Sticky section header */}
                  <div className="sticky z-30 bg-background/95 backdrop-blur-sm border-b-2 border-border" style={{ top: stickyOffset }}>
                    <div className="container flex items-center gap-4 h-11">
                      <h2 className="font-heading text-xl font-extrabold uppercase tracking-tight">{section.label}</h2>
                      <div className="flex-1 border-t-2 border-border" />
                      <span className="mono-label text-sm text-muted-foreground">{section.events.length}</span>
                    </div>
                  </div>

                  <div className="container py-8">
                    {section.events.length === 0 ? (
                      <p className="font-mono text-xs text-muted-foreground py-2">No events</p>
                    ) : section.layout === "list" ? (
                      <div className="space-y-6">
                        {groupByDate(section.events).map((group, gi) => (
                          <div key={group.date} className="border-2 border-border bg-background">
                            <div className="sticky z-20 flex items-center gap-3 px-4 py-3 bg-muted/60 backdrop-blur-sm border-b-2 border-border" style={{ top: stickyOffset + 46 }}>
                              <span className="font-heading text-sm font-extrabold uppercase tracking-tight">
                                {formatDaySeparator(group.date)}
                              </span>
                              <div className="flex-1 border-t border-border" />
                              <span className="font-mono text-[11px] text-muted-foreground">{group.events.length}</span>
                            </div>
                            <div className="divide-y divide-border/50">
                              {group.events.map((event) => (
                                <CompactRow key={event.id} event={event} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : section.layout === "grid-2" ? (
                      <div className="grid grid-cols-1 gap-6">
                        {section.events.map((event, i) => (
                          <EventCard key={event.id} event={event} index={i} onClick={handleEventClick} featured={featuredIds.has(event.id)} />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-6">
                        {section.events.map((event, i) => (
                          <EventCard key={event.id} event={event} index={i} onClick={handleEventClick} featured={featuredIds.has(event.id)} />
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              ));
            })()}
          </>
        )}

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
                  className="inline-flex h-12 px-8 items-center justify-center border-2 border-accent bg-accent text-accent-foreground font-body text-xs font-bold uppercase tracking-wider transition-all hover:bg-transparent hover:text-accent"
                >
                  Publish an event
                </Link>
                <Link
                  to="/for-bars"
                  className="inline-flex h-12 px-8 items-center justify-center border-2 border-primary-foreground/30 text-primary-foreground font-body text-xs font-bold uppercase tracking-wider transition-all hover:border-primary-foreground"
                >
                  Learn more
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />


    </div>
  );
}
