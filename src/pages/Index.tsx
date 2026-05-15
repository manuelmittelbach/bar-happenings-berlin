import { useMemo, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";
import EventCard from "@/components/events/EventCard";
import { PageSpinner } from "@/components/ui/page-spinner";
import { CategoryIconBar, CategoryRowPills } from "@/components/events/CategoryPill";
import TonightsHighlights from "@/components/events/TonightsHighlights";
import FreeTonightStrip from "@/components/events/FreeTonightStrip";
import StillRunningStrip from "@/components/events/StillRunningStrip";
import NearbyStrip from "@/components/events/NearbyStrip";
import DaySwitcher, { type DayTab } from "@/components/events/DaySwitcher";
import Footer from "@/components/layout/Footer";
import { useIsNative } from "@/hooks/useIsNative";

import type { BarlinEvent, Venue } from "@/types/event";
import { useEvents, useVenues, useCategories } from "@/hooks/useEvents";
import { useUserLocation } from "@/hooks/useUserLocation";
import { isEventStillOnline } from "@/lib/eventStatus";
import { berlinDateString, berlinDateStringOffset } from "@/lib/dateFormat";
import { useFilterParams } from "@/lib/useFilterParams";
import { isFreeOrDonation } from "@/lib/entryInfo";
import { computeNearbyEvents } from "@/lib/distance";

export const EXPLORE_SCROLL_KEY = "inside-bars-explore-scroll-y";
// Custom event dispatched by Header / Footer "Inside Bars" wordmarks when
// the user is already on "/". Index listens and scrolls its internal list
// container to the top — necessary because the page itself no longer
// scrolls (we lock the viewport and scroll inside a div instead, so
// window.scrollTo doesn't do anything).
export const SCROLL_HOME_EVENT = "inside-bars:scroll-home";

export default function Index() {
  const navigate = useNavigate();
  const {
    searchQuery,
    activeCategory, setActiveCategory,
    activeDate, setActiveDate,
  } = useFilterParams();

  const dayTab: DayTab =
    activeDate === "Tomorrow" ? "tomorrow"
    : activeDate === "Later" ? "later"
    : "tonight";

  // Resetting scroll on tab/category change targets the internal list
  // container — the page-level window scroll no longer exists. Inline
  // helper to avoid repeating the null-check at every call site.
  const resetScroll = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const handleDayTabChange = useCallback((t: DayTab) => {
    if (t === "tonight") setActiveDate("All");
    else if (t === "tomorrow") setActiveDate("Tomorrow");
    else setActiveDate("Later");
    // Every tab switch resets to the top — scroll position from the
    // previous day's list isn't meaningful against the new day's content.
    resetScroll();
  }, [setActiveDate, resetScroll]);

  // Same reasoning as the day-tab switch: when the user picks a new
  // category (or clears via "All"), the previous scroll position points
  // at a different set of events and reads as "stuck mid-page". Reset
  // to the top so the user sees the new feed from its first card.
  const handleCategoryChange = useCallback((c: string) => {
    setActiveCategory(c);
    resetScroll();
  }, [setActiveCategory, resetScroll]);

  // Internal list scroll container — the page itself no longer scrolls
  // (Layout locks Index's viewport like the Map page), so the section
  // headers stick relative to THIS container instead of the window, and
  // the scroll-memory save/restore reads its scrollTop instead of
  // window.scrollY.
  const scrollRef = useRef<HTMLDivElement>(null);

  // Header / Footer wordmark scrolls back to top via custom event — they
  // can't call window.scrollTo because the document doesn't scroll
  // anymore. Smooth so the gesture matches the "click wordmark to reset"
  // affordance from before the refactor.
  useEffect(() => {
    const handler = () => {
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener(SCROLL_HOME_EVENT, handler);
    return () => window.removeEventListener(SCROLL_HOME_EVENT, handler);
  }, []);

  const today = berlinDateString();
  const tomorrow = berlinDateStringOffset(1);
  // Yesterday is only relevant for the "Since yesterday" strip — events
  // that started before midnight and are still running into early today.
  const yesterday = berlinDateStringOffset(-1);
  // Fixed 2-week horizon: today + tomorrow + 12 more days. Anything past
  // this date is hidden — no "show more" affordance, no infinite scroll.
  const cutoffDate = berlinDateStringOffset(13);

  const { data: eventsData = [], isLoading: eventsLoading } = useEvents();
  const { data: categoriesData = [] } = useCategories();
  const { data: venuesData = [] } = useVenues();
  const { location: userLocation } = useUserLocation();
  // venueId → Venue lookup so NearbyStrip can resolve coords cheaply on
  // every render. Map (not Record) since we only need .get/.has.
  const venueMap = useMemo(() => {
    const m = new Map<string, Venue>();
    for (const v of venuesData) m.set(v.id, v);
    return m;
  }, [venuesData]);
  const categories = useMemo(
    () => categoriesData.filter((c) => c.enabled).map((c) => c.id),
    [categoriesData],
  );

  // Editorial sections (Highlights, Free, Since yesterday) must respect the
  // active category and search query — when the user filters to e.g.
  // "Music" or searches for a venue, a Free section full of unrelated events
  // would contradict the chosen filter. With both applied here, empty
  // sections collapse automatically since FreeTonightStrip /
  // TonightsHighlights / StillRunningStrip all return null on empty input.
  const matchesFilters = useCallback(
    (e: BarlinEvent) =>
      (!activeCategory || e.category === activeCategory) &&
      (!searchQuery || fuzzyMatchAny([e.venue, e.neighborhood], searchQuery)),
    [activeCategory, searchQuery],
  );
  // Canceled events stay in the today/tomorrow editorial feeds — EventCard
  // already shows them with line-through + "Canceled" pill, and filtering
  // them out hid free-tomorrow cancellations entirely (user expected to see
  // them so they know not to show up). `filtered` (used by More tonight /
  // tomorrow and Later) still drops canceled events more than a day out.
  const todayEvents = useMemo(
    () =>
      eventsData.filter(
        (e) =>
          e.date === today &&
          isEventStillOnline(e) &&
          matchesFilters(e),
      ),
    [eventsData, today, matchesFilters],
  );
  const tomorrowEvents = useMemo(
    () =>
      eventsData.filter(
        (e) =>
          e.date === tomorrow &&
          matchesFilters(e),
      ),
    [eventsData, tomorrow, matchesFilters],
  );
  const highlightedTonightEvents = useMemo(
    () => todayEvents.filter((e) => e.isHighlight),
    [todayEvents],
  );

  // Nearby strips — only populated when the user has granted location
  // (useUserLocation returns null until then, which collapses both
  // strips and skips the dedupe below entirely). Computed once per pool
  // here so the resulting IDs can drive "More tonight"/"More tomorrow"
  // dedupe — otherwise the same event would render in both Nearby and
  // More.
  const nearbyTonight = useMemo(
    () =>
      userLocation
        ? computeNearbyEvents(todayEvents, venueMap, userLocation)
        : [],
    [todayEvents, venueMap, userLocation],
  );
  const nearbyTomorrow = useMemo(
    () =>
      userLocation
        ? computeNearbyEvents(tomorrowEvents, venueMap, userLocation)
        : [],
    [tomorrowEvents, venueMap, userLocation],
  );
  const nearbyTonightIds = useMemo(
    () => new Set(nearbyTonight.map((n) => n.event.id)),
    [nearbyTonight],
  );
  const nearbyTomorrowIds = useMemo(
    () => new Set(nearbyTomorrow.map((n) => n.event.id)),
    [nearbyTomorrow],
  );
  // Walking-minutes by event id for every event whose venue is within the
  // 15-min cutoff — unrelated to whether that event made the top-6 Nearby
  // strip. Used by the DayList / LaterAgenda so a walking-chip surfaces on
  // any walkable event in any list, including the category-filtered
  // single-flat-list view where the Nearby strip itself doesn't render.
  const walkingMinByEventId = useMemo(() => {
    const m = new Map<string, number>();
    if (!userLocation) return m;
    // Re-using computeNearbyEvents with a generous limit captures every
    // walkable event without re-implementing the haversine + cutoff logic.
    // The limit just needs to exceed any realistic count of bars in a
    // 15-min walking radius — 200 is far above what Berlin has.
    const all = computeNearbyEvents(eventsData, venueMap, userLocation, 30, 200);
    for (const { event, min } of all) m.set(event.id, min);
    return m;
  }, [eventsData, venueMap, userLocation]);
  // Yesterday's events that haven't reached their endTime / startTime+2h yet.
  // Only populated in the post-midnight window where cross-day events leak in.
  const stillRunningYesterday = useMemo(
    () =>
      eventsData
        .filter(
          (e) =>
            e.date === yesterday &&
            isEventStillOnline(e) &&
            matchesFilters(e),
        )
        .sort((a, b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99")),
    [eventsData, yesterday, matchesFilters],
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
      result = result.filter((e) => e.date > tomorrow && e.date <= cutoffDate);
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
  }, [searchQuery, activeCategory, activeDate, today, tomorrow, eventsData, cutoffDate]);

  useLayoutEffect(() => {
    const savedScrollY = sessionStorage.getItem(EXPLORE_SCROLL_KEY);
    if (!savedScrollY) return;
    const scrollY = Number(savedScrollY);
    sessionStorage.removeItem(EXPLORE_SCROLL_KEY);
    // Two rAFs because the list content (sections, EventCards) only
    // mounts after eventsLoading flips false on the next paint — the
    // first frame restores onto a possibly-shorter list (Spinner only),
    // the second catches the real list once it's in the DOM. Same logic
    // as before, just targeting the internal scroll container.
    const firstFrame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
      });
    });
    return () => cancelAnimationFrame(firstFrame);
  }, []);

  const handleEventClick = useCallback((eventId: string) => {
    sessionStorage.setItem(
      EXPLORE_SCROLL_KEY,
      String(scrollRef.current?.scrollTop ?? 0),
    );
    navigate(`/event/${eventId}`);
  }, [navigate]);

  const showEditorial = dayTab === "tonight";
  const isNative = useIsNative();

  return (
    /* Map-style locked viewport — the outer container fills Layout's main
       area and the inner list container is the only thing that scrolls.
       That keeps the day + category chrome rock-still at the top edge
       (no mobile-URL-bar drift, no backdrop-blur jitter), and matches
       the architecture the user already knows from the Map page. */
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Chrome — Day filter + Category filter at the top, no longer
          sticky/fixed (just sits at the top of the flex column). Mobile
          shows rounded-full Tonight/Tomorrow/Later buttons; desktop
          shows the editorial DaySwitcher above the category pills. */}
      <div
        className="shrink-0 bg-background border-b-2 border-foreground md:border-b-0"
      >
        {/* Mobile — rounded-full Tonight/Tomorrow/Later buttons. */}
        <div className="md:hidden">
          <div id="date-filter-bar" className="container flex items-center gap-2 py-2.5">
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
        </div>
        {/* Desktop — DaySwitcher tab strip above the category pills.
            Same scroll-margin anchor as before so programmatic scroll-to
            ends up just below the page header. */}
        <div
          style={{ scrollMarginTop: 130 }}
          className="hidden md:block container pt-2"
        >
          <DaySwitcher active={dayTab} onChange={handleDayTabChange} />
        </div>
        <div className="container py-1.5 md:py-3">
          <div className="md:hidden">
            <CategoryIconBar
              categories={categories}
              activeCategory={activeCategory}
              onSelect={handleCategoryChange}
            />
          </div>
          <div className="hidden md:block">
            <CategoryRowPills
              categories={categories}
              activeCategory={activeCategory}
              onSelect={handleCategoryChange}
            />
          </div>
        </div>
      </div>

      {/* Internal scroll container — the only scrollable surface in this
          page. Sticky section headers inside (`top: 0`) now pin to this
          container's top edge, which sits right under the chrome above. */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        {eventsLoading ? (
          <PageSpinner />
        ) : (
          <>
          {/* TONIGHT — editorial sections + All Tonight list, OR a single
              flat "{Category} tonight" list when a category filter is
              active (the filter IS the discovery; splitting the result
              into Highlights/Free/More fragments a small subset into
              multiple mini-sections). */}
          {showEditorial && (() => {
            const activeCategoryLabel = activeCategory
              ? categoriesData.find((c) => c.id === activeCategory)?.label ?? activeCategory
              : null;

            // Category filter active → flat chronological list. Highlight/
            // Free signals stay on each EventCard inline (pills + indicator),
            // so no info is lost by collapsing the editorial structure.
            if (activeCategoryLabel) {
              return (
                <DayList
                  title={`${activeCategoryLabel} tonight`}
                  events={filtered}
                  onEventClick={handleEventClick}
                  emptyMessage={`No ${activeCategoryLabel} tonight.`}
                  onEmptyCta={{ label: "Change category →", onClick: () => handleCategoryChange("") }}
                  walkingMinByEventId={walkingMinByEventId}
                />
              );
            }

            // No category filter — full editorial structure. When every
            // strip collapses (e.g. nothing free + nothing highlighted),
            // the list isn't "more than" anything — it's the entire
            // tonight surface, so swap "More" → "All".
            const hasEditorialAbove =
              stillRunningYesterday.length > 0 ||
              highlightedTonightEvents.length > 0 ||
              nearbyTonight.length > 0 ||
              todayEvents.some((e) => isFreeOrDonation(e.entryInfo));
            return (
              <>
                {/* Carry-over from the previous calendar day — sits above
                    Tonight's Highlights so users see what's still happening
                    right now before scrolling into the curated picks. */}
                <StillRunningStrip
                  events={stillRunningYesterday}
                  categories={categoriesData}
                  onEventClick={handleEventClick}
                />
                <TonightsHighlights
                  events={highlightedTonightEvents}
                  categories={categoriesData}
                  onEventClick={handleEventClick}
                />
                {/* Nearby — only renders when useUserLocation has a value
                    (NearbyStrip short-circuits on empty input). Sits above
                    Free tonight because proximity beats price as a
                    universal "is this relevant to me right now" filter. */}
                <NearbyStrip
                  nearby={nearbyTonight}
                  onEventClick={handleEventClick}
                  title="Nearby tonight"
                />
                <FreeTonightStrip
                  events={todayEvents}
                  categories={categoriesData}
                  onEventClick={handleEventClick}
                  walkingMinByEventId={walkingMinByEventId}
                />
                <DayList
                  title={hasEditorialAbove ? "More tonight" : "All tonight"}
                  /* Dedup: drop events already shown above in Tonight's
                     Highlights (e.isHighlight), Nearby Tonight, and Free
                     Tonight (free or pay-what-you-want). The master list
                     reads as "what else is on tonight" instead of repeating
                     cards across editorial lenses. */
                  events={filtered.filter(
                    (e) =>
                      !e.isHighlight &&
                      !isFreeOrDonation(e.entryInfo) &&
                      !nearbyTonightIds.has(e.id),
                  )}
                  onEventClick={handleEventClick}
                  emptyMessage="That's it for tonight."
                  onEmptyCta={{ label: "See what's on tomorrow →", onClick: () => setActiveDate("Tomorrow") }}
                  walkingMinByEventId={walkingMinByEventId}
                />
              </>
            );
          })()}

          {dayTab === "tomorrow" && (() => {
            const activeCategoryLabel = activeCategory
              ? categoriesData.find((c) => c.id === activeCategory)?.label ?? activeCategory
              : null;

            // Same flat-list short-circuit as tonight when a category
            // filter is active.
            if (activeCategoryLabel) {
              return (
                <DayList
                  title={`${activeCategoryLabel} tomorrow`}
                  events={filtered}
                  onEventClick={handleEventClick}
                  emptyMessage={`No ${activeCategoryLabel} tomorrow.`}
                  onEmptyCta={{ label: "Change category →", onClick: () => handleCategoryChange("") }}
                  walkingMinByEventId={walkingMinByEventId}
                />
              );
            }

            const hasEditorialAbove =
              nearbyTomorrow.length > 0 ||
              tomorrowEvents.some((e) => isFreeOrDonation(e.entryInfo));
            return (
              <>
                <NearbyStrip
                  nearby={nearbyTomorrow}
                  onEventClick={handleEventClick}
                  title="Nearby tomorrow"
                />
                <FreeTonightStrip
                  events={tomorrowEvents}
                  categories={categoriesData}
                  onEventClick={handleEventClick}
                  title="Free tomorrow"
                  walkingMinByEventId={walkingMinByEventId}
                />
                <DayList
                  title={hasEditorialAbove ? "More tomorrow" : "All tomorrow"}
                  /* Same dedup as More tonight — drop free/donation events
                     and anything Nearby Tomorrow already surfaced, so the
                     master list reads as "what else is on tomorrow". */
                  events={filtered.filter(
                    (e) =>
                      !isFreeOrDonation(e.entryInfo) &&
                      !nearbyTomorrowIds.has(e.id),
                  )}
                  onEventClick={handleEventClick}
                  emptyMessage="That's it for tomorrow."
                  onEmptyCta={{ label: "See what's on later →", onClick: () => setActiveDate("Later") }}
                  walkingMinByEventId={walkingMinByEventId}
                />
              </>
            );
          })()}

          {dayTab === "later" && (
            <LaterAgenda
              events={filtered}
              onEventClick={handleEventClick}
              walkingMinByEventId={walkingMinByEventId}
            />
          )}
          </>
        )}
        {/* Footer lives inside the scroll container so users reach it at
            the natural end of the feed. Native context has the BottomTabBar
            instead — Footer would crowd the bar and duplicate links. */}
        {!isNative && <Footer />}
      </div>
    </div>
  );
}

/* ─────────────────────────  DayList  ─────────────────────────
 * Reusable "All {day}" section — SectionHeader + list of EventCards. Used
 * for both All Tonight and All Tomorrow so the two tabs share the same
 * editorial rhythm. */

interface DayListProps {
  // Section title — when omitted the list renders header-less. We drop the
  // header in filtered views where no editorial strip rendered above:
  // pairing "More tonight" with an empty space above reads as if the
  // word "More" lost its referent, and the DaySwitcher already supplies
  // the day context.
  title?: string;
  events: BarlinEvent[];
  onEventClick: (id: string) => void;
  emptyMessage: string;
  // Optional inline CTA shown under the empty-state message (Tonight uses
  // it to send users to the Tomorrow tab; Tomorrow doesn't need one).
  onEmptyCta?: { label: string; onClick: () => void };
  // When a card's event id appears in this map, the EventCard renders a
  // walking-distance chip in its meta row. Index passes a map covering all
  // events ≤ 15 min from the user — so a walkable event surfaces its chip
  // in this list even when the Nearby strip itself is collapsed (e.g. in
  // the category-filtered short-circuit).
  walkingMinByEventId?: Map<string, number>;
}

function DayList({ title, events, onEventClick, emptyMessage, onEmptyCta, walkingMinByEventId }: DayListProps) {
  // Empty state — drop the "More tonight" / "More tomorrow" header + counter
  // entirely. With a filter applied the list often collapses to zero, and
  // pairing the bold header "More tonight" with the body line "Nothing more
  // for tonight" reads as a contradiction. Showing only the italic empty
  // message + CTA keeps the section honest and lets the eye fall straight
  // to the redirect.
  if (events.length === 0) {
    return (
      <section className="container py-12 md:py-16 text-center">
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
      </section>
    );
  }

  return (
    <section className="container py-6 md:py-8">
      {title && (
        // Section header — sticky on mobile so it pins below the
        // day+category chrome (matches StillRunningStrip /
        // FreeTonightStrip). Static on desktop. Top-padding lives on the
        // <section>, NOT on this wrapper, so the heading hugs the chrome's
        // bottom edge when pinned instead of sitting 24px lower.
        <div
          className="mb-2.5 sticky md:static bg-background z-30"
          style={{ top: 0 }}
        >
          <div className="pt-2.5 pb-2.5 flex items-baseline gap-3.5 flex-wrap border-b-2 border-border">
            {/* Same size as the weekday separators in the Later section so all
                list headings ("More tonight", "Tomorrow", …) read at the
                same typographic weight. */}
            <h2 className="heading-display text-2xl md:text-[30px] leading-none m-0">{title}</h2>
            <span className="flex-1" />
            {/* Counter — auf Mobile nur die Zahl, auf Desktop „N more"
                (ohne „events"-Suffix, redundant zum Section-Title). */}
            <span className="mono-label text-muted-foreground">
              <span className="md:hidden">{events.length}</span>
              <span className="hidden md:inline">{events.length} more</span>
            </span>
          </div>
        </div>
      )}

      <div>
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            layout="list"
            onClick={onEventClick}
            walkingMin={walkingMinByEventId?.get(event.id)}
          />
        ))}
      </div>
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
  // Same role as DayList's walkingMinByEventId — Later events that happen
  // to be at a walkable venue still get the chip, so the walking signal
  // stays consistent across the index.
  walkingMinByEventId?: Map<string, number>;
}

function LaterAgenda({ events, onEventClick, walkingMinByEventId }: LaterAgendaProps) {
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
          Nothing posted. Check back tomorrow morning.
        </p>
      </section>
    );
  }

  return (
    /* Each weekday gets its own <section> as the containing block for
       its sticky header, AND the inter-day visual gap lives INSIDE the
       previous section as pb-7 (instead of mt-7 between sections). The
       sections butt up flush, so when Friday's section.bottom reaches
       chrome-bottom, Saturday's section.top is there at the same
       instant — Saturday sticks, Friday gets pushed up by section-end.
       Visually: Saturday rises from Friday's bottom hairline upward,
       pushing Friday up by its own height. */
    <div className="container pb-6 md:pb-8">
      {groups.map((g) => {
        const d = new Date(g.date + "T00:00:00");
        // Long weekday name on every viewport — matches "Tonight" /
        // "Tomorrow" labels in the day switcher, which are also fully
        // spelled out, so the visual rhythm stays consistent.
        const wdLong = d.toLocaleDateString("en-GB", { weekday: "long" });
        const dom = d.getDate();
        const mon = d.toLocaleDateString("en-GB", { month: "short" });
        return (
          <section key={g.date} className="mt-20 first:mt-0 pt-6 md:pt-8">
            {/* Sticky weekday header — pins below the day+category chrome
                while its section scrolls past. Top-padding lives on the
                <section> (not the sticky wrapper), so when pinned the
                weekday hugs the chrome's bottom edge instead of sitting
                ~34px lower. Inner pt-2.5 keeps 10px breathing room above
                the text when stuck. Each section is the implicit scroll
                container for its sticky, so the next weekday cleanly
                pushes the previous one out as it scrolls into view. */}
            <div
              className="mb-2.5 sticky z-30 bg-background"
              style={{ top: 0 }}
            >
              <div className="pt-2.5 pb-2.5 flex items-baseline gap-3.5 flex-wrap border-b-2 border-border">
                <h3 className="heading-display text-2xl md:text-[30px] leading-none m-0">
                  {wdLong}
                </h3>
                <span className="mono-label text-muted-foreground">{dom} {mon}</span>
                <span className="flex-1" />
                {/* Counter — auf Mobile nur die Zahl, auf Desktop „N
                    events" (Platz da, also explizit). */}
                <span className="mono-label text-muted-foreground">
                  <span className="md:hidden">{g.events.length}</span>
                  <span className="hidden md:inline">
                    {g.events.length} {g.events.length === 1 ? "event" : "events"}
                  </span>
                </span>
              </div>
            </div>
            {g.events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                layout="list"
                onClick={onEventClick}
                walkingMin={walkingMinByEventId?.get(event.id)}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
