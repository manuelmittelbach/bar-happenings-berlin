import { useState, useMemo, useCallback, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Search, Users } from "lucide-react";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import EventCard from "@/components/events/EventCard";
import CategoryPill, { CategoryIconBar, CategoryIconRow } from "@/components/events/CategoryPill";


import { events, categories, neighborhoods, getCategoryInfoByLabel } from "@/data/mockData";
import type { BarlinEvent } from "@/data/mockData";

const dateFilters = ["All", "Today", "Tomorrow", "This Week"];
const entryFilters = ["All", "Free Entry", "Pay at Venue"];
const EXPLORE_SCROLL_KEY = "tipsy-tiger-explore-scroll-y";

export default function Index() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  
  const [activeCategory, setActiveCategory] = useState("");
  const [activeNeighborhood, setActiveNeighborhood] = useState("");
  const [activeDate, setActiveDate] = useState("All");
  const [activeEntry, setActiveEntry] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  
  

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

    result.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

    const seen = new Set<string>();
    result = result.filter((e) => {
      if (seen.has(e.parentId)) return false;
      seen.add(e.parentId);
      return true;
    });

    return result;
  }, [searchQuery, activeCategory, activeNeighborhood, activeDate, activeEntry, today, tomorrow]);

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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <section className="border-b-2 border-foreground noise-bg bg-muted/40">
          <div className="container py-12 md:py-16 lg:py-20 relative z-10">
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by bar, neighborhood, or event..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-10 pr-4 bg-background border-2 border-foreground text-sm font-mono placeholder:text-muted-foreground outline-none focus:bg-muted transition-colors"
                />
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
        <div className="sticky top-[57px] z-40 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="container py-3">
            {/* Mobile: icon scroller */}
            <div className="md:hidden">
              <CategoryIconBar
                categories={categories}
                activeCategory={activeCategory}
                onSelect={setActiveCategory}
              />
            </div>
            {/* Desktop: icon row */}
            <div className="hidden md:block">
              <CategoryIconRow
                categories={categories}
                activeCategory={activeCategory}
                onSelect={setActiveCategory}
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

        {filtered.length === 0 ? (
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
              const todayEvents = filtered.filter((e) => e.date === today);
              const tomorrowEvents = filtered.filter((e) => e.date === tomorrow);
              const thisWeekEvents = filtered.filter((e) => e.date > tomorrow && e.date <= weekEnd);
              const laterEvents = filtered.filter((e) => e.date > weekEnd && e.date <= monthEnd);
              const evenLaterEvents = filtered.filter((e) => e.date > monthEnd);

              if (todayEvents.length) sections.push({ label: "Today", events: todayEvents, layout: "grid-2" });
              if (tomorrowEvents.length) sections.push({ label: "Tomorrow", events: tomorrowEvents, layout: "grid-2" });
              if (thisWeekEvents.length) sections.push({ label: "This week", events: thisWeekEvents, layout: "list" });
              if (laterEvents.length) sections.push({ label: "This month", events: laterEvents, layout: "list" });
              if (evenLaterEvents.length) sections.push({ label: "Later", events: evenLaterEvents, layout: "list" });

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
                    className={`w-full flex flex-col gap-0.5 py-3.5 px-4 hover:bg-muted/50 transition-colors text-left group ${isLive ? "bg-[hsl(0,72%,51%)]/[0.04]" : ""}`}
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
                <section key={section.label} className={`${sectionBgs[si % sectionBgs.length]} ${si > 0 ? "border-t border-border" : ""}`}>
                  <div className="container py-10">
                    <div className="flex items-center gap-4 mb-6">
                      <h2 className="font-heading text-3xl md:text-4xl font-extrabold uppercase tracking-tight">{section.label}</h2>
                      <div className="flex-1 border-t-2 border-border" />
                      <span className="mono-label text-lg text-muted-foreground">{section.events.length}</span>
                    </div>

                    {section.layout === "list" ? (
                      <div className="space-y-6">
                        {groupByDate(section.events).map((group, gi) => (
                          <div key={group.date} className="border-2 border-border bg-background">
                            <div className="sticky top-[112px] z-10 flex items-center gap-3 px-4 py-3 bg-muted/60 backdrop-blur-sm border-b-2 border-border">
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
                      <>
                        {groupByDate(section.events).map((group, gi) => (
                          <div key={group.date}>
                            {gi > 0 && (
                              <div className="flex items-center gap-3 my-4">
                                <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
                                  {formatDaySeparator(group.date)}
                                </span>
                                <div className="flex-1 border-t border-border" />
                              </div>
                            )}
                            {gi === 0 && (
                              <div className="flex items-center gap-3 mb-4">
                                <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
                                  {formatDaySeparator(group.date)}
                                </span>
                                <div className="flex-1 border-t border-border" />
                              </div>
                            )}
                            <div className="grid grid-cols-1 gap-6 mb-4">
                              {group.events.map((event, i) => (
                                <EventCard key={event.id} event={event} index={i} onClick={handleEventClick} featured={featuredIds.has(event.id)} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </>
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
