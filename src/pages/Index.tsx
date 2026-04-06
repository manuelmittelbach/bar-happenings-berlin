import { useState, useMemo, useCallback, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Search, Users } from "lucide-react";
import { motion } from "framer-motion";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import EventCard from "@/components/events/EventCard";
import CategoryPill, { CategoryIconBar } from "@/components/events/CategoryPill";

import EventDetailDialog from "@/components/events/EventDetailDialog";
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
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  

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
    if (isMobile) {
      sessionStorage.setItem(EXPLORE_SCROLL_KEY, String(window.scrollY));
      navigate(`/event/${eventId}`);
    } else {
      setSelectedEventId(eventId);
    }
  }, [isMobile, navigate]);

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
            </motion.div>
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
            {/* Desktop: 2-row grid layout */}
            <div className="hidden md:grid grid-cols-5 lg:grid-cols-9 gap-1.5">
              <button
                onClick={() => setActiveCategory("")}
                className={`px-3 py-2 font-mono text-[11px] uppercase tracking-wider border transition-all text-center ${
                  !activeCategory
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-2 font-mono text-[11px] uppercase tracking-wider border transition-all text-center truncate ${
                    activeCategory === cat
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
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
                const catInfo = getCategoryInfoByLabel(event.category);
                const hash = event.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
                const interested = (hash % 42) + 1;
                return (
                  <button
                    onClick={() => handleEventClick(event.id)}
                    className="w-full flex items-center gap-3 py-3 px-2 hover:bg-muted/50 transition-colors text-left group"
                  >
                    <span className="shrink-0 inline-flex items-center justify-center px-2.5 py-1 bg-muted border border-border font-mono text-[11px] text-muted-foreground uppercase tracking-wider min-w-[52px] text-center">
                      {formatDatePill(event.date)}
                    </span>
                    <span
                      className="shrink-0 w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: catInfo?.color || "hsl(var(--accent))" }}
                    />
                    <span className="font-body font-bold text-sm group-hover:text-accent transition-colors truncate flex-1 min-w-0">
                      {cleanEventTitle(event.title, event.venue)}
                    </span>
                    <span className="hidden sm:block text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                      {event.venue} · {event.neighborhood}
                    </span>
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs text-accent font-mono">
                      <Users className="h-3 w-3" />
                      {interested}
                    </span>
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
                      <div className="border-2 border-border divide-y divide-border bg-background">
                        {groupByDate(section.events).map((group, gi) => (
                          <div key={group.date}>
                            <div className="flex items-center gap-3 px-3 py-2 bg-muted/30">
                              <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
                                {formatDaySeparator(group.date)}
                              </span>
                              <div className="flex-1 border-t border-border" />
                            </div>
                            {group.events.map((event) => (
                              <CompactRow key={event.id} event={event} />
                            ))}
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
                  className="inline-flex h-12 px-8 items-center justify-center border-2 border-accent bg-accent text-accent-foreground font-heading text-xs font-bold uppercase tracking-wider transition-all hover:bg-transparent hover:text-accent"
                >
                  Publish an event
                </Link>
                <Link
                  to="/for-bars"
                  className="inline-flex h-12 px-8 items-center justify-center border-2 border-primary-foreground/30 text-primary-foreground font-heading text-xs font-bold uppercase tracking-wider transition-all hover:border-primary-foreground"
                >
                  Learn more
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />

      <EventDetailDialog
        eventId={selectedEventId}
        open={!!selectedEventId}
        onOpenChange={(open) => {
          if (!open) setSelectedEventId(null);
        }}
        onEventChange={(id) => setSelectedEventId(id)}
      />

    </div>
  );
}
