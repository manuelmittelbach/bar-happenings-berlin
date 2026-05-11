import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";
import { Search, Map, X } from "lucide-react";

import EventCard from "@/components/events/EventCard";
import { PageSpinner } from "@/components/ui/page-spinner";
import { CategoryIconBar, CategoryRowPills } from "@/components/events/CategoryPill";
import TonightsHighlights from "@/components/events/TonightsHighlights";
import FreeTonightStrip from "@/components/events/FreeTonightStrip";
import DaySwitcher, { type DayTab } from "@/components/events/DaySwitcher";

import type { BarlinEvent } from "@/types/event";
import { useEvents, useVenues, useCategories } from "@/hooks/useEvents";
import { isEventStillOnline } from "@/lib/eventStatus";
import { berlinDateString, berlinDateStringOffset } from "@/lib/dateFormat";
import { useFilterParams } from "@/lib/useFilterParams";
import { isFreeOrDonation } from "@/lib/entryInfo";

export const EXPLORE_SCROLL_KEY = "inside-bars-explore-scroll-y";

// Hero animation runs once per page-load; internal navigations skip it.
let heroAnimationPlayed = false;

export default function Index() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    searchQuery, setSearchQuery,
    activeCategory, setActiveCategory,
    activeDate, setActiveDate,
  } = useFilterParams();

  const dayTab: DayTab =
    activeDate === "Tomorrow" ? "tomorrow"
    : activeDate === "Later" ? "later"
    : "tonight";

  const handleDayTabChange = useCallback((t: DayTab) => {
    if (t === "tonight") setActiveDate("All");
    else if (t === "tomorrow") setActiveDate("Tomorrow");
    else setActiveDate("Later");
  }, [setActiveDate]);

  const [animateHero] = useState(() => !heroAnimationPlayed);
  useEffect(() => {
    if (animateHero) heroAnimationPlayed = true;
  }, [animateHero]);

  const categoryBarRef = useRef<HTMLDivElement>(null);

  const today = berlinDateString();
  const tomorrow = berlinDateStringOffset(1);
  const cutoffDate = berlinDateStringOffset(14);

  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const { data: eventsData = [], isLoading: eventsLoading } = useEvents();
  const { data: venuesData = [] } = useVenues();
  const { data: categoriesData = [] } = useCategories();
  const categories = useMemo(
    () => categoriesData.filter((c) => c.enabled).map((c) => c.id),
    [categoriesData],
  );

  const todayEvents = useMemo(
    () => eventsData.filter((e) => e.date === today && isEventStillOnline(e) && e.status !== "canceled"),
    [eventsData, today],
  );
  const tomorrowEvents = useMemo(
    () => eventsData.filter((e) => e.date === tomorrow && e.status !== "canceled"),
    [eventsData, tomorrow],
  );
  const highlightedTonightEvents = useMemo(
    () => todayEvents.filter((e) => e.isHighlight),
    [todayEvents],
  );

  const filtered = useMemo(() => {
    let result = [...eventsData];
    result = result.filter((e) => isEventStillOnline(e));
    // Hide canceled events except today/tomorrow — no point cluttering the list
    // with cancellations far in advance.
    result = result.filter((e) => {
      if (e.status !== "canceled") return true;
      return e.date === today || e.date === tomorrow;
    });
    if (searchQuery) {
      // Match against both venue name and neighborhood so neighborhood
      // suggestions from the hero dropdown actually filter the list.
      result = result.filter((e) => fuzzyMatchAny([e.venue, e.neighborhood], searchQuery));
    }
    if (activeCategory) result = result.filter((e) => e.category === activeCategory);
    if (activeDate === "Today" || activeDate === "All") {
      result = result.filter((e) => e.date === today);
    } else if (activeDate === "Tomorrow") {
      result = result.filter((e) => e.date === tomorrow);
    } else if (activeDate === "Later") {
      result = result.filter(
        (e) => e.date > tomorrow && (showAllUpcoming || e.date <= cutoffDate),
      );
    }
    // Chronological — over events are already filtered out by isEventStillOnline.
    result.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      const tA = a.startTime || "99:99";
      const tB = b.startTime || "99:99";
      return tA.localeCompare(tB);
    });
    return result;
  }, [searchQuery, activeCategory, activeDate, today, tomorrow, eventsData, showAllUpcoming, cutoffDate]);

  const hasMoreUpcoming = useMemo(
    () => activeDate === "Later" && eventsData.some(
      (e) => e.date > tomorrow && e.date > cutoffDate && isEventStillOnline(e),
    ),
    [eventsData, activeDate, tomorrow, cutoffDate],
  );

  useLayoutEffect(() => {
    if (sessionStorage.getItem("inside-bars-scroll-to-filter") === "1") {
      sessionStorage.removeItem("inside-bars-scroll-to-filter");
      const scrollToFilter = () => {
        document.getElementById("date-filter-bar")?.scrollIntoView({ block: "start", behavior: "auto" });
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
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
      });
    });
    return () => cancelAnimationFrame(firstFrame);
  }, []);

  const handleEventClick = useCallback((eventId: string) => {
    sessionStorage.setItem(EXPLORE_SCROLL_KEY, String(window.scrollY));
    navigate(`/event/${eventId}`);
  }, [navigate]);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  /* Suggestions — venues match first, then unique neighborhoods that
   * contain the query. Returns up to 4 results (2 bars + 2 neighborhoods
   * max) so the dropdown stays compact. */
  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const bars: { label: string; type: "bar" | "neighborhood" }[] = [];
    const hoods: { label: string; type: "bar" | "neighborhood" }[] = [];
    const seenBar = new Set<string>();
    const seenHood = new Set<string>();
    for (const v of venuesData) {
      if (v.name.toLowerCase().includes(q) && !seenBar.has(v.name)) {
        seenBar.add(v.name);
        bars.push({ label: v.name, type: "bar" });
      }
      const hood = (v as { neighborhood?: string }).neighborhood;
      if (hood && hood.toLowerCase().includes(q) && !seenHood.has(hood)) {
        seenHood.add(hood);
        hoods.push({ label: hood, type: "neighborhood" });
      }
    }
    return [...bars.slice(0, 2), ...hoods.slice(0, 2)];
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

  const showEditorial = dayTab === "tonight";

  return (
    <>
      {/* Hero — display headline + subdeck + search input.
          Layout matches `Hero.jsx`: eyebrow, h1, subdeck, search, each
          fading in as a whole element (stagger per block, not per word).
          The headline is plain inline text so the natural word-wrap
          mirrors the prototype's behavior at every viewport width. */}
      <section className="relative overflow-x-clip pt-11 pb-8">
        <div className="container relative z-[45]" style={{ maxWidth: 1100 }}>
          <motion.p
            className="font-mono font-bold uppercase text-accent"
            style={{ fontSize: 11, letterSpacing: "0.14em", marginBottom: 18 }}
            initial={animateHero ? { opacity: 0, y: 12 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
          >
            Berlin's independent bar guide
          </motion.p>

          <motion.h1
            className="heading-display leading-[0.95] m-0"
            style={{ fontSize: "clamp(48px, 7.5vw, 96px)" }}
            initial={animateHero ? { opacity: 0, y: 12 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            What's on{" "}
            <span
              className="heading-editorial lowercase italic"
              style={{ letterSpacing: "-0.01em" }}
            >
              tonight
            </span>
            <br />in Berlin bars
            <span className="text-accent" style={{ fontStyle: "normal" }}>?</span>
          </motion.h1>

          <motion.p
            className="font-body max-w-[580px]"
            style={{
              fontSize: 18,
              lineHeight: 1.55,
              marginTop: 22,
              marginBottom: 28,
              textWrap: "balance",
            }}
            initial={animateHero ? { opacity: 0, y: 12 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            All the small, independent, slightly chaotic things happening in Berlin tonight.
          </motion.p>

          <motion.div
            className="relative max-w-[480px]"
            initial={animateHero ? { opacity: 0, y: 12 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            ref={searchWrapperRef}
          >
            {/* Input box — the dropdown sits as a SIBLING below so its
                left/right edges align with the input box's outer edges
                (left:0 right:0 on the relative motion.div). */}
            <div className="flex items-center h-[52px] px-[14px] bg-background border-2 border-foreground">
              <Search className="h-[18px] w-[18px] text-foreground shrink-0 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(e) => { if (e.key === "Escape") setShowSuggestions(false); }}
                placeholder="search by bar or neighborhood"
                autoComplete="off"
                className="flex-1 ml-2.5 min-w-0 bg-transparent border-0 font-body text-[15px] text-foreground placeholder:text-muted-foreground outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
                style={{ outline: "none", boxShadow: "none" }}
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => { setSearchQuery(""); setShowSuggestions(false); }}
                  className="h-7 w-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div
                className="absolute left-0 right-0 z-[60] border-2 border-foreground border-t-0 bg-background"
                style={{ top: "100%", marginTop: -2 }}
              >
                {suggestions.map((s) => (
                  <button
                    key={`${s.type}-${s.label}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setSearchQuery(s.label);
                      setShowSuggestions(false);
                    }}
                    className="w-full flex items-center justify-between gap-2 py-2.5 hover:bg-muted transition-colors text-left border-b border-border last:border-b-0"
                    /* Indent matches input text start: outer padding 14 +
                       search icon 18 + ml-2.5 (10) = 42. */
                    style={{ paddingLeft: 42, paddingRight: 14 }}
                  >
                    <span className="font-body text-[15px] text-foreground truncate min-w-0">
                      {s.label}
                    </span>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground shrink-0">
                      {s.type === "bar" ? "Bar" : "Neighborhood"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Sticky category filter — icon-disk row (mobile scroller / desktop
          row) matching /map. Reverted from the pill variant to the icon
          style requested in the design review. */}
      <div
        ref={categoryBarRef}
        className="sticky top-[64px] z-40 bg-background/95 backdrop-blur-sm border-b border-border"
      >
        <div className="container py-3">
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

      {/* DaySwitcher — Tonight · Tomorrow · Later */}
      <div
        id="date-filter-bar"
        /* 64 header + sticky category icon row + buffer — keeps the
           Tonight/Tomorrow/Later tabs visible just under the sticky chrome
           after a Header "Tonight" click instead of slipping behind it. */
        style={{ scrollMarginTop: 130 }}
        className="container pt-2"
      >
        <DaySwitcher active={dayTab} onChange={handleDayTabChange} />
      </div>

      {eventsLoading ? (
        <PageSpinner />
      ) : (
        <>
          {/* TONIGHT — editorial sections + All Tonight list */}
          {showEditorial && (
            <>
              <TonightsHighlights
                events={highlightedTonightEvents}
                categories={categoriesData}
                onEventClick={handleEventClick}
              />
              <FreeTonightStrip
                events={todayEvents}
                categories={categoriesData}
                onEventClick={handleEventClick}
              />
              <DayList
                title="More tonight"
                /* Dedup: drop events already shown above in Tonight's
                   Highlights (e.isHighlight) and Free Tonight (free or
                   pay-what-you-want). The master list reads as "what
                   else is on tonight" instead of repeating cards. */
                events={filtered.filter(
                  (e) => !e.isHighlight && !isFreeOrDonation(e.entryInfo),
                )}
                onEventClick={handleEventClick}
                emptyMessage="Nothing posted for tonight."
                onEmptyCta={{ label: "See what's on tomorrow →", onClick: () => setActiveDate("Tomorrow") }}
              />
            </>
          )}

          {dayTab === "tomorrow" && (
            <>
              <FreeTonightStrip
                events={tomorrowEvents}
                categories={categoriesData}
                onEventClick={handleEventClick}
                title="Free tomorrow"
              />
              <DayList
                title="More tomorrow"
                /* Same dedup as More tonight — drop the free/donation
                   events that already render in Free Tomorrow above. */
                events={filtered.filter((e) => !isFreeOrDonation(e.entryInfo))}
                onEventClick={handleEventClick}
                emptyMessage="Tomorrow's lineup lands at 09:00 every morning."
              />
            </>
          )}

          {dayTab === "later" && (
            <LaterAgenda
              events={filtered}
              onEventClick={handleEventClick}
              showMore={hasMoreUpcoming && !showAllUpcoming}
              onShowMore={() => setShowAllUpcoming(true)}
            />
          )}
        </>
      )}

      {/* Floating Map — black on cream, half-pill, anchored to the right
          edge. Border is in the background (cream) color so the button
          stays visible when it overlaps the inverted footer: invisible
          against cream paper, becomes a cream halo against the black footer. */}
      <button
        onClick={() => {
          sessionStorage.setItem(EXPLORE_SCROLL_KEY, String(window.scrollY));
          navigate({ pathname: "/map", search: location.search });
        }}
        className="fixed bottom-6 right-0 z-[9999] flex items-center gap-2 h-12 pl-5 pr-4 bg-foreground text-background font-mono font-bold text-xs uppercase tracking-wider shadow-lg hover:bg-foreground/90 transition-all rounded-l-full border-2 border-r-0 border-background"
      >
        <Map className="h-4 w-4" />
        Map
      </button>
    </>
  );
}

/* ─────────────────────────  DayList  ─────────────────────────
 * Reusable "All {day}" section — SectionHeader + list of EventCards. Used
 * for both All Tonight and All Tomorrow so the two tabs share the same
 * editorial rhythm. */

interface DayListProps {
  title: string;
  events: BarlinEvent[];
  onEventClick: (id: string) => void;
  emptyMessage: string;
  // Optional inline CTA shown under the empty-state message (Tonight uses
  // it to send users to the Tomorrow tab; Tomorrow doesn't need one).
  onEmptyCta?: { label: string; onClick: () => void };
}

function DayList({ title, events, onEventClick, emptyMessage, onEmptyCta }: DayListProps) {
  return (
    <section className="container py-6 md:py-8">
      <div className="flex items-baseline justify-between gap-4 flex-wrap border-b-2 border-foreground pb-3.5 mt-10 mb-5">
        <h2 className="heading-display text-3xl md:text-[38px] leading-none m-0">{title}</h2>
        <div className="mono-label text-muted-foreground">
          {events.length} {events.length === 1 ? "event" : "events"}
        </div>
      </div>

      {events.length === 0 ? (
        <div className="py-12 text-center">
          <p className="font-body italic text-[18px] m-0">{emptyMessage}</p>
          {onEmptyCta && (
            <button
              type="button"
              onClick={onEmptyCta.onClick}
              className="mono-label text-accent border-b-2 border-accent pb-0.5 mt-3"
            >
              {onEmptyCta.label}
            </button>
          )}
        </div>
      ) : (
        <div>
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              layout="list"
              onClick={onEventClick}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ─────────────────────────  Later  ─────────────────────────
 * Day-grouped agenda — each date gets its own header (weekday + DOM Month +
 * count) over a 2px black rule, then a list of EventCards. Mirrors the
 * `LaterAgenda` component in the design prototype. */

interface LaterAgendaProps {
  events: BarlinEvent[];
  onEventClick: (id: string) => void;
  showMore: boolean;
  onShowMore: () => void;
}

function LaterAgenda({ events, onEventClick, showMore, onShowMore }: LaterAgendaProps) {
  const groups = useMemo(() => {
    const out: { date: string; events: BarlinEvent[] }[] = [];
    for (const e of events) {
      const last = out[out.length - 1];
      if (last && last.date === e.date) last.events.push(e);
      else out.push({ date: e.date, events: [e] });
    }
    return out;
  }, [events]);

  if (!groups.length) {
    return (
      <section className="container py-6 md:py-8">
        <p className="font-body italic text-[16px] text-muted-foreground pt-8 m-0">
          Nothing posted for the next seven days. Check back tomorrow morning.
        </p>
      </section>
    );
  }

  return (
    <div className="container py-6 md:py-8">
      {groups.map((g) => {
        const d = new Date(g.date + "T00:00:00");
        const wd = d.toLocaleDateString("en-GB", { weekday: "short" });
        const dom = d.getDate();
        const mon = d.toLocaleDateString("en-GB", { month: "short" });
        return (
          <section key={g.date} className="mt-7">
            <div className="border-b-2 border-foreground pb-2.5 mb-3.5 flex items-baseline gap-3.5 flex-wrap">
              <h3 className="heading-display text-2xl md:text-[30px] leading-none m-0">{wd}</h3>
              <span className="mono-label text-muted-foreground">{dom} {mon}</span>
              <span className="flex-1" />
              <span className="mono-label text-muted-foreground">
                {g.events.length} {g.events.length === 1 ? "event" : "events"}
              </span>
            </div>
            {g.events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                layout="list"
                onClick={onEventClick}
              />
            ))}
          </section>
        );
      })}

      {showMore && (
        <div className="flex justify-center mt-7">
          <button onClick={onShowMore} className="btn-outline" style={{ height: 44 }}>
            Show more events
          </button>
        </div>
      )}
    </div>
  );
}
