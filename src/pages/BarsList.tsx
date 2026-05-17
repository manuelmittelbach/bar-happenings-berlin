import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, MapPin, Search, X } from "lucide-react";
import { useVenues, useEvents } from "@/hooks/useEvents";
import { addSoftHyphens } from "@/lib/cleanTitle";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";
import { isEventStillOnline } from "@/lib/eventStatus";
import { berlinDateString, berlinDateStringOffset } from "@/lib/dateFormat";
import { useFilterParams } from "@/lib/useFilterParams";
import { ALL_NEIGHBORHOODS } from "@/lib/neighborhoodFromAddress";
import DaySwitcher, { type DayTab } from "@/components/events/DaySwitcher";
import { PageSpinner } from "@/components/ui/page-spinner";
import type { Venue, BarlinEvent } from "@/types/event";

/* BarsList — directory of every venue, grouped by neighborhood.
 *
 * Day chrome (Tonight / Tomorrow / Later) sits at the top, mirroring
 * Index and MapPage so the three primary surfaces share the same
 * navigation. The selected day is shared via `useFilterParams`, so
 * switching from "Tomorrow" on Events → Bars keeps the tomorrow lens.
 *
 * Hoods are ordered LIVE by how many of their bars have something
 * happening on the selected day: busiest hood first, quiet hoods at
 * the bottom. That turns the directory from a static phone book into
 * a "where in Berlin is something on" lens that complements the map
 * (spatial) and the events list (chronological).
 *
 * Each card carries a tiny mono signal line when the bar has at least
 * one event on the selected day. That line is its own click target —
 * exactly-one event jumps straight to the event page, multiple events
 * deepen to the bar page where they're all listed. The rest of the
 * card always links to bar detail.
 */
export default function BarsList() {
  const { data: venues = [], isLoading: venuesLoading } = useVenues();
  // All upcoming events. Same hook the Index page uses, so the shared
  // cache means switching Events ↔ Bars doesn't refetch.
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const [nameQuery, setNameQuery] = useState("");
  // Two collapsible filter panels — name search and neighborhood pick.
  // Both default closed so the masthead + hood-grouped directory get
  // the visual weight; filters open on intent. Each toggles
  // independently so the user can layer name + hood if they want.
  const [nameOpen, setNameOpen] = useState(false);
  const [hoodOpen, setHoodOpen] = useState(false);

  // Day + neighborhood filters — shared with Index + MapPage via
  // useFilterParams so the user's selection follows them across the
  // three surfaces. Picking "Kreuzberg" on Bars and clicking through
  // to Events keeps the Kreuzberg lens. Same "All" = tonight encoding
  // Index/Map already use.
  const {
    activeDate, setActiveDate,
    activeNeighborhood, setActiveNeighborhood,
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

  const today = berlinDateString();
  const tomorrow = berlinDateStringOffset(1);
  // Same Later window as Index — day-after-tomorrow through today+13.
  const cutoffDate = berlinDateStringOffset(13);

  // Test for "does this event fall inside the currently-selected day
  // bucket?" Mirrors the same logic Index uses for its day-scoped
  // filters so a bar's tonight-count matches what shows up under
  // Tonight on the Events page.
  const matchesDay = useCallback(
    (e: BarlinEvent): boolean => {
      if (dayTab === "tonight") return e.date === today;
      if (dayTab === "tomorrow") return e.date === tomorrow;
      return e.date > tomorrow && e.date <= cutoffDate;
    },
    [dayTab, today, tomorrow, cutoffDate],
  );

  // Events grouped by venueId, filtered to the selected day. Drives
  // both the per-card signal line and the per-hood section-header
  // counter. For Tonight/Tomorrow the list is sorted by start time;
  // for Later we sort by date then time so the chronologically nearest
  // event surfaces first when there's only one to display.
  const eventsForDayByVenue = useMemo(() => {
    const map = new Map<string, BarlinEvent[]>();
    for (const e of events) {
      if (!matchesDay(e)) continue;
      if (e.status === "canceled") continue;
      // Tonight bucket: drop events whose end-of-day cutoff has passed
      // (matches Index/Map). For tomorrow + later, "still online" is
      // implicit (the event hasn't happened yet).
      if (dayTab === "tonight" && !isEventStillOnline(e)) continue;
      if (!e.venueId) continue;
      const list = map.get(e.venueId) || [];
      list.push(e);
      map.set(e.venueId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date);
        if (dateCmp !== 0) return dateCmp;
        return (a.startTime || "99:99").localeCompare(b.startTime || "99:99");
      });
    }
    return map;
  }, [events, matchesDay, dayTab]);

  // Hood pill order is locked to the unfiltered dataset so the row
  // doesn't reshuffle as the user types in name search. One-time sort:
  // by total bar count (busiest first), then alphabetical for ties;
  // hoods with zero bars sink to the bottom. Recomputes only when
  // venues changes.
  const hoodOrder = useMemo(() => {
    const totals = new Map<string, number>();
    for (const v of venues) {
      const h = (v.neighborhood || "").trim();
      if (!h) continue;
      totals.set(h, (totals.get(h) || 0) + 1);
    }
    const names = new Set<string>([...ALL_NEIGHBORHOODS, ...totals.keys()]);
    return [...names]
      .map((name) => ({ name, total: totals.get(name) || 0 }))
      .sort((a, b) => {
        if ((b.total > 0) !== (a.total > 0)) return b.total > 0 ? 1 : -1;
        if (b.total !== a.total) return b.total - a.total;
        return a.name.localeCompare(b.name);
      });
  }, [venues]);

  // Name + hood filter pass. Both filters compose, mirroring how
  // Index/Map combine search + neighborhood. Hood reuses the same
  // shared useFilterParams slot Events/Map already use.
  const filteredVenues = useMemo(() => {
    let result = venues;
    if (nameQuery.trim()) {
      result = result.filter((v) => fuzzyMatchAny([v.name], nameQuery));
    }
    if (activeNeighborhood) {
      result = result.filter((v) => v.neighborhood === activeNeighborhood);
    }
    return result;
  }, [venues, nameQuery, activeNeighborhood]);

  // Live counts per hood for the pill row. The displayed count is
  // the number of BARS WITH EVENTS on the selected day — matches
  // both the hood ordering (which sorts by this same number) and the
  // section-header counter ("12 bars · 3 tonight"), so the pill, the
  // sort, and the header all speak the same vocabulary. Counts react
  // to name-search but not to the active hood (otherwise picking a
  // hood would zero out every sibling).
  //
  // `hasBars` is tracked separately so the disabled state reflects
  // whether a hood has any bars at all under the current name search
  // — picking a hood with 0 active bars on the selected day is still
  // useful (browse the bars there, even when nothing's on).
  const neighborhoods = useMemo(() => {
    const pool = nameQuery.trim()
      ? venues.filter((v) => fuzzyMatchAny([v.name], nameQuery))
      : venues;
    const barsWithEventsCounts = new Map<string, number>();
    const barCounts = new Map<string, number>();
    for (const v of pool) {
      const h = (v.neighborhood || "").trim();
      if (!h) continue;
      barCounts.set(h, (barCounts.get(h) || 0) + 1);
      const hasEvents = (eventsForDayByVenue.get(v.id)?.length || 0) > 0;
      if (hasEvents) {
        barsWithEventsCounts.set(h, (barsWithEventsCounts.get(h) || 0) + 1);
      }
    }
    return hoodOrder.map(({ name }) => ({
      name,
      count: barsWithEventsCounts.get(name) || 0,
      hasBars: (barCounts.get(name) || 0) > 0,
    }));
  }, [hoodOrder, venues, nameQuery, eventsForDayByVenue]);

  // Group venues by neighborhood, then sort hoods by selected-day
  // activity. Within each hood, bars with events on the selected day
  // come first (sorted by event count), then alpha for the quiet rest.
  // Venues without a hood land in an "Other" bucket pinned to the
  // bottom so nothing disappears.
  const hoods = useMemo(() => {
    const groups = new Map<string, Venue[]>();
    for (const v of filteredVenues) {
      const h = (v.neighborhood || "").trim() || "Other";
      const list = groups.get(h) || [];
      list.push(v);
      groups.set(h, list);
    }

    return [...groups.entries()]
      .map(([name, items]) => {
        const sorted = [...items].sort((a, b) => {
          const aDay = eventsForDayByVenue.get(a.id)?.length || 0;
          const bDay = eventsForDayByVenue.get(b.id)?.length || 0;
          if (aDay !== bDay) return bDay - aDay;
          return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
        });
        // dayBars (used for hood ordering) and dayEvents (used for
        // the section-header counter). Two different stats because
        // the SORT favors hood diversity (many bars active = high
        // dayBars) while the displayed COUNTER favors raw activity
        // ("X events tonight" — what's literally on).
        const dayBars = sorted.filter(
          (v) => (eventsForDayByVenue.get(v.id)?.length || 0) > 0,
        ).length;
        const dayEvents = sorted.reduce(
          (acc, v) => acc + (eventsForDayByVenue.get(v.id)?.length || 0),
          0,
        );
        return { name, items: sorted, dayBars, dayEvents };
      })
      .sort((a, b) => {
        if (a.name === "Other") return 1;
        if (b.name === "Other") return -1;
        // Primary: hoods with selected-day activity first.
        if (a.dayBars !== b.dayBars) return b.dayBars - a.dayBars;
        // Secondary: by total bar count (denser hood breaks ties).
        if (a.items.length !== b.items.length) return b.items.length - a.items.length;
        return a.name.localeCompare(b.name);
      });
  }, [filteredVenues, eventsForDayByVenue]);

  // Total event count across filtered venues for the selected day.
  // Drives the masthead counter label ("X events tonight"). Counts
  // events, not bars — a single bar with 3 events on the selected day
  // contributes 3 to this number. Matches the natural reading of "X
  // events tonight" as "X events are happening" rather than "X bars
  // are active". Per-hood section-header counters still surface the
  // bars-with-events number (more useful at the hood level because
  // the user is choosing between bars there).
  const totalDayEvents = useMemo(() => {
    let n = 0;
    for (const v of filteredVenues) {
      n += eventsForDayByVenue.get(v.id)?.length || 0;
    }
    return n;
  }, [filteredVenues, eventsForDayByVenue]);

  // Word used in counters / card lines for the selected day.
  // "tonight" / "tomorrow" / "later" — matches the DaySwitcher labels
  // so the page's vocabulary is consistent top-to-bottom.
  const dayWord = dayTab === "tonight" ? "tonight" : dayTab === "tomorrow" ? "tomorrow" : "later";

  const showNoDirectory = venues.length === 0;
  const showNoMatch = !showNoDirectory && filteredVenues.length === 0;
  const showResults = !showNoDirectory && !showNoMatch;

  if (venuesLoading || eventsLoading) return <PageSpinner />;

  return (
    <div className="relative isolate bg-background pb-24">
      {/* Atmosphere — same orange/amber radial pair as BarDetail so the
          index and detail surfaces share the same warm color world. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute right-[-22%] top-[80px] h-[600px] w-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(circle at center, hsla(18, 85%, 52%, 0.07), hsla(18, 85%, 52%, 0) 60%)",
            filter: "blur(40px)",
          }}
        />
        <div
          className="absolute left-[-15%] top-[260px] h-[420px] w-[420px] rounded-full"
          style={{
            background:
              "radial-gradient(circle at center, hsla(28, 85%, 55%, 0.05), hsla(28, 85%, 55%, 0) 60%)",
            filter: "blur(40px)",
          }}
        />
        <div
          className="absolute left-[-22%] top-[1100px] h-[600px] w-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(circle at center, hsla(18, 85%, 52%, 0.07), hsla(18, 85%, 52%, 0) 60%)",
            filter: "blur(40px)",
          }}
        />
      </div>

      {/* Day chrome — Tonight / Tomorrow / Later. Mirrors Index + Map:
          rounded rect buttons on mobile (compact density), full
          DaySwitcher tab strip on desktop (editorial weight). Lives
          OUTSIDE the inner container so it can carry full-width mobile
          chrome bottom rule like the other surfaces. */}
      <div className="bg-background border-b-2 border-foreground md:border-b-0">
        <div className="md:hidden">
          <div className="container flex items-center gap-2 py-2.5">
            {([
              { id: "tonight", label: "Tonight" },
              { id: "tomorrow", label: "Tomorrow" },
              { id: "later", label: "Later" },
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
        </div>
        {/* Day chrome at the standard `container` width — matches the
            global Header and the Events/Map chrome, so the
            Tonight/Tomorrow/Later tabs sit at the exact same
            horizontal position across all three surfaces (no jump
            when navigating between them). */}
        <div className="hidden md:block container">
          <DaySwitcher active={dayTab} onChange={handleDayTabChange} />
        </div>
      </div>

      <div className="container pt-4 md:pt-6">
        {/* Masthead — heading-display 24/30px under a hairline rule
            with an event counter on the right. Just the live signal:
            "{N} event{s} {dayWord}". Bar count is intentionally
            omitted (the user reads it from the directory below), so
            the page's headline number stays singular and live. */}
        <header className="mb-6 md:mb-8">
          <div className="pt-2.5 pb-2.5 flex items-baseline gap-3.5 flex-wrap border-b-2 border-border">
            <h1 className="heading-display text-2xl md:text-[30px] leading-none m-0">
              All the bars
            </h1>
            <span className="flex-1" />
            {totalDayEvents > 0 && (
              <span className="mono-label text-accent">
                {totalDayEvents} event{totalDayEvents !== 1 ? "s" : ""} {dayWord}
              </span>
            )}
          </div>
        </header>

        {/* Filter row — name search + neighborhood pick, both as
            sharp 2px-bordered toggles. The neighborhood filter lasers
            the directory to one hood (other hoods drop). Day filter
            sits in the top chrome above and applies independently. */}
        <div className="mb-8 md:mb-10">
          <div className="flex flex-wrap items-center gap-2">
            <FilterToggle
              icon={<Search className="h-3.5 w-3.5" />}
              labelShort="Search"
              labelLong="Search by name"
              open={nameOpen}
              onToggle={() => setNameOpen((s) => !s)}
            />
            <FilterToggle
              icon={<MapPin className="h-3.5 w-3.5" />}
              labelShort={activeNeighborhood || "Neighborhood"}
              labelLong={activeNeighborhood ? `Neighborhood · ${activeNeighborhood}` : "Search by neighborhood"}
              open={hoodOpen}
              onToggle={() => setHoodOpen((s) => !s)}
              active={!!activeNeighborhood}
            />
          </div>

          <AnimatePresence initial={false}>
            {nameOpen && (
              <motion.div
                key="name-panel"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <label className="relative block w-full md:max-w-sm mt-4">
                  <span className="sr-only">Search bars by name</span>
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                  />
                  <input
                    type="search"
                    autoFocus
                    value={nameQuery}
                    onChange={(e) => setNameQuery(e.target.value)}
                    placeholder="Search bars by name…"
                    className="w-full h-11 pl-10 pr-10 bg-background border-2 border-foreground font-body text-[14px] outline-none focus:bg-card transition-colors placeholder:text-muted-foreground/70 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
                  />
                  {nameQuery && (
                    <button
                      type="button"
                      onClick={() => setNameQuery("")}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-muted active:opacity-60 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </label>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Neighborhood pill grid — wraps across multiple rows so
              every hood is visible at once. Same shape system as the
              category pills on Events/Map: sharp 2px-bordered on
              desktop, round on mobile. Picking a hood writes to the
              shared activeNeighborhood slot so the choice carries
              across to Events/Map. */}
          <AnimatePresence initial={false}>
            {hoodOpen && neighborhoods.length > 0 && (
              <motion.div
                key="hood-panel"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <HoodPill
                    label="All"
                    active={!activeNeighborhood}
                    onClick={() => setActiveNeighborhood("")}
                  />
                  {neighborhoods.map((h) => (
                    <HoodPill
                      key={h.name}
                      label={h.name}
                      count={h.count}
                      active={activeNeighborhood === h.name}
                      disabled={!h.hasBars}
                      onClick={() => setActiveNeighborhood(activeNeighborhood === h.name ? "" : h.name)}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {showNoDirectory && (
          <p className="font-body italic text-[16px] text-muted-foreground py-8">
            No bars in the directory yet.
          </p>
        )}

        {showNoMatch && (
          <section className="py-12 md:py-16 text-center">
            <p className="font-body italic text-[18px] m-0">
              No bars match "{nameQuery.trim()}".
            </p>
            <button
              type="button"
              onClick={() => setNameQuery("")}
              className="mono-label text-accent border-b-2 border-accent pb-0.5 mt-3"
            >
              Reset search →
            </button>
          </section>
        )}

        {showResults && (
          <div className="space-y-8 md:space-y-10">
            {hoods.map((hood) => (
              <section key={hood.name}>
                {/* Hood divider — same section-header pattern as
                    FreeTonightStrip / DayList: heading-display 24/30px
                    on a hairline rule with a mono counter on the right.
                    Sticky pins it below the page Header as the user
                    scrolls into a hood. */}
                <div
                  className="mb-3 md:mb-4 sticky bg-background z-30"
                  style={{ top: "var(--header-h)" }}
                >
                  <div className="pt-2.5 pb-2.5 flex items-baseline gap-3.5 flex-wrap border-b-2 border-border">
                    <h2 className="heading-display text-2xl md:text-[30px] leading-none m-0">
                      {hood.name}
                    </h2>
                    <span className="flex-1" />
                    {hood.dayEvents > 0 && (
                      <span className="mono-label text-accent">
                        {hood.dayEvents} event{hood.dayEvents !== 1 ? "s" : ""} {dayWord}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 md:gap-4">
                  {hood.items.map((v) => (
                    <BarCard
                      key={v.id}
                      venue={v}
                      dayEvents={eventsForDayByVenue.get(v.id) || []}
                      dayTab={dayTab}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* FilterToggle — sharp 2px-bordered button that expands/collapses its
 * filter panel. `active` flips the button to a filled state so the
 * neighborhood toggle can carry the selected hood name in its label
 * (e.g. "NEIGHBORHOOD · KREUZBERG") and read at a glance as "filtered". */
function FilterToggle({
  icon,
  labelShort,
  labelLong,
  open,
  onToggle,
  active = false,
}: {
  icon: React.ReactNode;
  labelShort: string;
  labelLong: string;
  open: boolean;
  onToggle: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`inline-flex h-11 items-center gap-2 border-2 border-foreground px-3.5 md:px-5 md:min-w-[240px] font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
        active
          ? "bg-foreground text-background"
          : "bg-background text-foreground hover:bg-foreground hover:text-background"
      }`}
    >
      {icon}
      <span className="md:mr-auto truncate max-w-[140px] md:max-w-none">
        <span className="md:hidden">{labelShort}</span>
        <span className="hidden md:inline">{labelLong}</span>
      </span>
      <ChevronDown
        aria-hidden
        className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
      />
    </button>
  );
}

/* HoodPill — neighborhood filter chip. Sharp 2px-bordered rectangle
 * on desktop and round pill on mobile, matching the category-filter
 * shape system across the app. The bar count rides in mono inside
 * the pill so the label reads as a filter, not just a tag. Empty
 * hoods (no bars under current search) stay in the row but are
 * de-emphasized and non-interactive so the row reads as a complete
 * map of Berlin without lying about counts. */
function HoodPill({
  label,
  count,
  active,
  disabled = false,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const base =
    "shrink-0 inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full md:rounded-none border-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition-colors";
  const tone = disabled
    ? "border-foreground/20 text-foreground/35 cursor-not-allowed"
    : active
      ? "border-foreground bg-foreground text-background"
      : "border-foreground hover:bg-foreground hover:text-background";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`${base} ${tone}`}
    >
      <span className="normal-case tracking-normal font-body font-medium text-[13px]">
        {label}
      </span>
      {typeof count === "number" && (
        <span
          className={
            disabled
              ? "text-foreground/30"
              : active
                ? "opacity-60"
                : "text-muted-foreground"
          }
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* Format "Fri 22 May" — used by the Later card line when the bar has
 * exactly one event in the next 12-day window. Surfaces the actual
 * date instead of a vague "later", because in the Later view the user
 * is comparing dates across bars and a specific weekday + DOM + month
 * is the load-bearing signal. */
function formatShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/* BarCard — sharp 2px-bordered editorial card. Image lede on top, bar
 * name below. When the bar has events on the selected day, a small
 * mono signal line sits under the name as its own click target.
 *
 * Implementation: the outer wrapper is an <article>. A bare <Link>
 * absolutely covers the whole card at z-0 (the default whole-card
 * affordance). The signal line is a separately-stacked <Link> with
 * `relative z-10` so its hit area sits ABOVE the cover link. Visual
 * content sits between with pointer-events-none so clicks fall through
 * to whichever link owns the pixel under the cursor. The article
 * carries `group` so group-hover styles on the title still fire when
 * the user hovers anywhere on the card. */
function BarCard({
  venue,
  dayEvents,
  dayTab,
}: {
  venue: Venue;
  dayEvents: BarlinEvent[];
  dayTab: DayTab;
}) {
  const cleanAddress = venue.address?.replace(/,\s*(Germany|Deutschland)\s*$/i, "") ?? "";
  const hasDayEvents = dayEvents.length > 0;
  // Single-event: deep-link to the event. Multi-event: deepen to the
  // bar page (where all upcoming events sit at top), since there's no
  // single event to jump to.
  const signalHref =
    dayEvents.length === 1
      ? `/event/${dayEvents[0].id}`
      : `/bar/${venue.id}`;
  // Signal label — day-aware. For Tonight/Tomorrow + 1 event we show
  // "Tonight · 21:00" / "Tomorrow · 21:00". For Later + 1 we surface
  // the concrete date because the user is comparing across days
  // ("Fri 22 May · 21:00"). Multi-event collapses to a count line in
  // the matching tense.
  let signalLabel: string;
  if (dayEvents.length === 1) {
    const e = dayEvents[0];
    const time = e.startTime ? ` · ${e.startTime}` : "";
    if (dayTab === "tonight") signalLabel = `Tonight${time}`;
    else if (dayTab === "tomorrow") signalLabel = `Tomorrow${time}`;
    else signalLabel = `${formatShortDate(e.date)}${time}`;
  } else {
    const word = dayTab === "tonight" ? "tonight" : dayTab === "tomorrow" ? "tomorrow" : "upcoming";
    signalLabel = `${dayEvents.length} events ${word}`;
  }

  return (
    <article className="group relative bg-background border-2 border-foreground hover:border-accent transition-all overflow-hidden shadow-[0_18px_40px_-28px_hsla(18,85%,52%,0.3)] hover:shadow-[0_22px_50px_-28px_hsla(18,85%,52%,0.4)]">
      {/* Whole-card cover link → bar detail. Sits at z-0 behind the
          signal line so the signal line wins on its own hit area. */}
      <Link
        to={`/bar/${venue.id}`}
        aria-label={venue.name}
        className="absolute inset-0 z-0"
      />

      {/* Visual content — pointer-events-none so clicks fall through. */}
      <div className="relative pointer-events-none">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted border-b-2 border-foreground">
          {venue.image ? (
            <img
              src={venue.image}
              alt={venue.name}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            // Quiet editorial placeholder for missing images: warm
            // radial tint, hairline crosshairs, 8px accent dot, mono
            // "Inside · Bars" caption in the corner.
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 28% 32%, hsla(28, 85%, 55%, 0.20), hsla(18, 85%, 52%, 0.06) 65%)",
              }}
            >
              <span
                className="absolute inset-x-0 top-1/2 h-px bg-foreground/10"
                style={{ transform: "translateY(-0.5px)" }}
              />
              <span
                className="absolute inset-y-0 left-1/2 w-px bg-foreground/10"
                style={{ transform: "translateX(-0.5px)" }}
              />
              <span
                className="absolute left-1/2 top-1/2 rounded-full bg-accent"
                style={{ width: 8, height: 8, transform: "translate(-50%, -50%)" }}
              />
              <span className="absolute right-3 bottom-2.5 font-mono text-[9px] uppercase tracking-[0.18em] text-foreground/45">
                Inside · Bars
              </span>
            </div>
          )}
        </div>
        <div className="p-4 md:p-5">
          <h3
            lang="de"
            className="font-body text-[22px] font-bold leading-[1.2] m-0 transition-colors group-hover:text-accent break-words hyphens-auto"
          >
            {addSoftHyphens(venue.name)}
          </h3>
          {cleanAddress && (
            <p className="hidden md:block mt-1.5 font-body text-[13px] leading-[1.5] text-foreground/80 line-clamp-1 break-words">
              {cleanAddress}
            </p>
          )}
        </div>
      </div>

      {/* Day signal line — its own Link, stacked above the cover.
          Pulsing accent dot mirrors the live "Now" indicator in
          EventMeta, tying the directory back to the events page
          vocabulary. The dot is muted slightly for Tomorrow/Later
          since those events aren't happening RIGHT NOW. */}
      {hasDayEvents && (
        <div className="relative z-10 px-4 md:px-5 pb-4 md:pb-5 -mt-1 md:-mt-1.5">
          <Link
            to={signalHref}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] font-bold text-accent hover:text-foreground transition-colors"
            aria-label={
              dayEvents.length === 1
                ? `${signalLabel} at ${venue.name}: ${dayEvents[0].title}`
                : `${dayEvents.length} events ${dayTab === "tonight" ? "tonight" : dayTab === "tomorrow" ? "tomorrow" : "upcoming"} at ${venue.name}`
            }
          >
            <span
              aria-hidden
              className={`inline-block h-1.5 w-1.5 rounded-full bg-accent ${
                dayTab === "tonight" ? "animate-pulse" : ""
              }`}
            />
            {signalLabel}
          </Link>
        </div>
      )}
    </article>
  );
}
