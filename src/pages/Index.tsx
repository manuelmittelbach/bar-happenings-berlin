import { useMemo, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate, useNavigationType, useLocation } from "react-router-dom";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";
import EventCard from "@/components/events/EventCard";
import { PageSpinner } from "@/components/ui/page-spinner";
import { ErrorState } from "@/components/ui/error-state";
import { CategoryIconBar, CategoryRowPills } from "@/components/events/CategoryPill";
import TonightsHighlights from "@/components/events/TonightsHighlights";
import FreeTonightStrip from "@/components/events/FreeTonightStrip";
import StillRunningStrip from "@/components/events/StillRunningStrip";
import NearbyStrip from "@/components/events/NearbyStrip";
import DayStrip from "@/components/events/DayStrip";
import Footer from "@/components/layout/Footer";
import { useIsNative } from "@/hooks/useIsNative";

import type { BarlinEvent, Venue } from "@/types/event";
import { useEvents, useVenues, useCategories } from "@/hooks/useEvents";
import { useUserLocation } from "@/hooks/useUserLocation";
import { isEventStillOnline } from "@/lib/eventStatus";
import { resolveActiveDay, compareByStartTime, compareChronological } from "@/lib/eventListing";
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
  const navigationType = useNavigationType();
  const location = useLocation();
  const {
    searchQuery,
    activeCategory, setActiveCategory,
    activeDate, setActiveDate,
  } = useFilterParams();

  // The concrete Berlin date the day strip is on — stale or out-of-strip
  // stored values silently resolve to today (the Tonight view).
  const activeIso = resolveActiveDay(activeDate);

  // Resetting scroll on tab/category change targets the internal list
  // container — the page-level window scroll no longer exists. Inline
  // helper to avoid repeating the null-check at every call site.
  const resetScroll = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const handleDayChange = useCallback((value: string) => {
    setActiveDate(value);
    // Every day switch resets to the top — scroll position from the
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
  // Day scoping is a plain date match against activeIso — the DayStrip only
  // offers the 7-day visible horizon (see VISIBLE_HORIZON), anything beyond
  // stays hidden until it rolls into the strip.

  const {
    data: eventsData = [],
    isLoading: eventsLoading,
    isError: eventsError,
    refetch: refetchEvents,
    isFetching: eventsFetching,
  } = useEvents();
  const { data: categoriesData = [] } = useCategories();
  const { data: venuesData = [] } = useVenues();
  const isNative = useIsNative();
  // Nearby is native-only: web never asks for location on the home page (the
  // browser only requests it on the Map). On native, refresh every 60s (and on
  // app re-focus) so the feed tracks the user as they move — no continuous watch.
  const { location: userLocation } = useUserLocation({ enabled: isNative, refreshMs: 60_000 });
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
  // tomorrow and the weekday views) still drops canceled events more than a
  // day out.
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
  // strip. Used by the DayList so a walking-chip surfaces on
  // any walkable event in any list, including the category-filtered
  // single-flat-list view where the Nearby strip itself doesn't render.
  const walkingMinByEventId = useMemo(() => {
    const m = new Map<string, number>();
    if (!userLocation) return m;
    // Re-using computeNearbyEvents with a generous limit captures every
    // walkable event without re-implementing the haversine + cutoff logic.
    // The limit just needs to exceed any realistic count of bars in a
    // 15-min walking radius — 200 is far above what Berlin has.
    const all = computeNearbyEvents(eventsData, venueMap, userLocation, 15, 200);
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
        .sort(compareByStartTime),
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
    // One `now` snapshot for the whole pass so every event is matched
    // against the same instant (the memo re-runs when today/tomorrow roll).
    const now = new Date();
    const dayIso = resolveActiveDay(activeDate, now);
    result = result.filter((e) => e.date === dayIso);
    // Chronological — over events are already filtered out by isEventStillOnline.
    result.sort(compareChronological);
    return result;
  }, [searchQuery, activeCategory, activeDate, today, tomorrow, eventsData]);

  // Restore the internal scroll position ONLY on back/forward navigation
  // (POP) — that's the browser-native convention. A fresh PUSH/REPLACE into
  // the page (link click, new visit) starts at the top, so we drop any stale
  // saved value instead of restoring it.
  //
  // Done in two steps so the restore can't lose the position to a timing
  // race: capture the saved offset once on mount, then apply it only after
  // the list has actually rendered (eventsLoading === false). An earlier
  // scrollTo would clamp against a still-too-short container (Spinner only)
  // and the target would be silently lost.
  const restoreTargetRef = useRef<number | null>(null);
  const restoreCapturedRef = useRef(false);
  useLayoutEffect(() => {
    if (restoreCapturedRef.current) return;
    restoreCapturedRef.current = true;
    if (navigationType === "POP") {
      const saved = sessionStorage.getItem(EXPLORE_SCROLL_KEY);
      restoreTargetRef.current = saved !== null ? Number(saved) : null;
    }
    // Consume it either way so a later re-render / PUSH can't replay it.
    sessionStorage.removeItem(EXPLORE_SCROLL_KEY);
  }, [navigationType]);

  useLayoutEffect(() => {
    const target = restoreTargetRef.current;
    if (target === null || eventsLoading) return;
    // Re-attempt across frames until the container is tall enough to honor
    // the saved offset (images, sticky headers and sections settle over a
    // few paints), then stop. Without the retry, a single scrollTo onto a
    // not-yet-final layout is exactly what dropped us back to the top.
    let attempts = 0;
    let frame = 0;
    const tryRestore = () => {
      const node = scrollRef.current;
      if (node) {
        node.scrollTo({ top: target, left: 0, behavior: "auto" });
        const reachedTarget = Math.abs(node.scrollTop - target) <= 1;
        const atMaxScroll =
          node.scrollTop >= node.scrollHeight - node.clientHeight - 1;
        if (reachedTarget || atMaxScroll) {
          restoreTargetRef.current = null;
          return;
        }
      }
      if (attempts++ < 20) {
        frame = requestAnimationFrame(tryRestore);
      } else {
        restoreTargetRef.current = null;
      }
    };
    frame = requestAnimationFrame(tryRestore);
    return () => cancelAnimationFrame(frame);
  }, [eventsLoading]);

  // Persist the internal scroll position whenever the page unmounts — i.e.
  // ANY navigation away (nav tab, event click, browser back). The window-level
  // ScrollManager in App.tsx can't see this locked-viewport container's
  // scrollTop, so we snapshot it here for the POP-restore above to pick up.
  //
  // We can't read scrollTop in the unmount cleanup directly: React detaches
  // the container from the DOM BEFORE this passive-effect cleanup runs, and a
  // detached scrollable element reports scrollTop === 0 — so the cleanup would
  // always save 0 (the original bug). Instead we mirror the live scrollTop
  // into a ref on every scroll while the container is mounted, and persist
  // that last-known value on unmount.
  const lastScrollTopRef = useRef(0);
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const handleScroll = () => {
      lastScrollTopRef.current = node.scrollTop;
    };
    node.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      node.removeEventListener("scroll", handleScroll);
      sessionStorage.setItem(
        EXPLORE_SCROLL_KEY,
        String(lastScrollTopRef.current),
      );
    };
  }, []);

  // Deep-scroll target handed over by a landing-page hero card tap (router
  // state). Once the list has painted, scroll the internal container straight
  // to that event's card and flash it, then strip the state so a later
  // re-render / back-nav doesn't re-trigger the jump.
  const scrollToEventId =
    (location.state as { scrollToEventId?: string } | null)?.scrollToEventId ?? null;
  useEffect(() => {
    if (!scrollToEventId || eventsLoading) return;
    // Two rAFs: the first lands after the list commits, the second after
    // layout settles (sticky headers, images reserving space) so the
    // measured offset is final. Mirrors the POP-restore timing above.
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = scrollRef.current;
        const target = container?.querySelector(
          `[data-event-id="${CSS.escape(scrollToEventId)}"]`,
        ) as HTMLElement | null;
        if (container && target) {
          // The target card's own section header (e.g. "More events") is
          // sticky at the container's top edge. Land the card so its top edge
          // sits flush against the header's bottom hairline (the grey line) —
          // no gap, nothing tucked behind it. Subtract the header's rendered
          // height (measured off the element, so it's correct at any scroll
          // position). Strips without a sticky header (Editor's picks grid)
          // yield 0 and the card just lands at the container top.
          const stickyHeader =
            target.closest("section")?.querySelector<HTMLElement>(".sticky");
          const clearance = stickyHeader ? stickyHeader.offsetHeight : 0;
          const containerRect = container.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          // Only scroll when the card isn't already fully on screen — its top
          // must clear the sticky header and its bottom must sit above the
          // container's bottom edge. If it's visible, leave the list put and
          // just flag the card.
          const fullyVisible =
            targetRect.top >= containerRect.top + clearance &&
            targetRect.bottom <= containerRect.bottom;
          if (!fullyVisible) {
            const dest = Math.max(
              0,
              targetRect.top - containerRect.top + container.scrollTop - clearance,
            );
            container.scrollTo({ top: dest, behavior: "smooth" });
          }
        }
        // Clear the one-shot target only AFTER scrolling — doing it earlier
        // would re-render with no state and the effect cleanup would cancel
        // this very frame before it runs.
        navigate(location.pathname, { replace: true, state: null });
      });
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToEventId, eventsLoading]);

  const handleEventClick = useCallback((eventId: string) => {
    navigate(`/event/${eventId}`);
  }, [navigate]);

  const isTonight = activeIso === today;
  const isTomorrow = activeIso === tomorrow;
  const showEditorial = isTonight;

  return (
    /* Map-style locked viewport — the outer container fills Layout's main
       area and the inner list container is the only thing that scrolls.
       That keeps the day + category chrome rock-still at the top edge
       (no mobile-URL-bar drift, no backdrop-blur jitter), and matches
       the architecture the user already knows from the Map page. */
    <div className="flex flex-col flex-1 overflow-hidden overscroll-x-none">
      {/* Chrome — Day strip + Category filter at the top, no longer
          sticky/fixed (just sits at the top of the flex column). The
          DayStrip is one shared surface for mobile and desktop, matching
          MapPage exactly. */}
      <div
        className="shrink-0 bg-background border-b-2 border-foreground md:border-b-0"
      >
        <div className="container">
          <DayStrip activeIso={activeIso} onChange={handleDayChange} />
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
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0"
        /* Native: BottomTabBar is fixed and floats over the viewport, so
           without reserving its height here the last cards + closing block
           hide behind it and are only revealed by bounce-scrolling. The
           padding-bottom adds matching dead-space inside the scroller so
           the final content can scroll fully above the bar. Web (no tab
           bar) renders the Footer inline at the end instead. */
        style={isNative ? { paddingBottom: "var(--tab-bar-h)" } : undefined}
      >
        {/* Inner flex column with min-h-full so when the list is short
            (single event under a category filter), the Footer's mt-auto
            below still pushes it to the bottom of the scroll viewport
            instead of floating right under the last card with a wall of
            cream below. When the list is tall enough to scroll, the inner
            grows past min-h-full and behaves normally. */}
        <div className="flex flex-col min-h-full">
          <div className="flex-1">
        {eventsLoading ? (
          <PageSpinner />
        ) : eventsError && eventsData.length === 0 ? (
          // The fetch failed AND we have nothing cached to fall back on —
          // show a retry surface instead of the editorial empty states
          // ("That's it for tonight."), which would wrongly read as "the
          // city is quiet" when really the data never loaded.
          <ErrorState
            inline
            message="Couldn't reach the events. Check your connection and try again."
            onRetry={() => refetchEvents()}
            isRetrying={eventsFetching}
          />
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
                  // No title/counter on filtered short-circuits — the
                  // sticky CategoryIconBar above already shows which
                  // category is active (highlighted pill), so repeating
                  // it as a heading just doubles the same context. The
                  // list speaks for itself.
                  events={filtered}
                  onEventClick={handleEventClick}
                  emptyMessage={`No ${activeCategoryLabel} tonight.`}
                  onEmptyCta={{ label: "Clear filter →", onClick: () => handleCategoryChange("") }}
                  walkingMinByEventId={walkingMinByEventId}
                />
              );
            }

            // No category filter — full editorial structure. When every
            // strip collapses (e.g. nothing free + nothing highlighted),
            // the list isn't "more than" anything, so drop the section
            // header entirely — the DayStrip chrome already supplies
            // the "Tonight" context.
            const hasFreeTonight = todayEvents.some((e) => isFreeOrDonation(e.entryInfo));
            const hasEditorialAbove =
              stillRunningYesterday.length > 0 ||
              highlightedTonightEvents.length > 0 ||
              nearbyTonight.length > 0 ||
              hasFreeTonight;
            const moreEventsTonight = filtered.filter(
              (e) =>
                !e.isHighlight &&
                !isFreeOrDonation(e.entryInfo) &&
                !nearbyTonightIds.has(e.id),
            );
            // Closing block fires once at page level only when every
            // tonight surface a user can see is empty — highlights, nearby,
            // free, and the master "more events" list. With even one event
            // visible somewhere, "That's it for tonight" would contradict
            // the screen.
            const tonightAllEmpty =
              stillRunningYesterday.length === 0 &&
              highlightedTonightEvents.length === 0 &&
              nearbyTonight.length === 0 &&
              !hasFreeTonight &&
              moreEventsTonight.length === 0;
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
                />
                <FreeTonightStrip
                  events={todayEvents}
                  categories={categoriesData}
                  onEventClick={handleEventClick}
                  walkingMinByEventId={walkingMinByEventId}
                />
                <DayList
                  title={hasEditorialAbove ? "More events" : undefined}
                  /* Dedup: drop events already shown above in Tonight's
                     Highlights (e.isHighlight), Nearby Tonight, and Free
                     Tonight (free or pay-what-you-want). The master list
                     reads as "what else is on tonight" instead of repeating
                     cards across editorial lenses. */
                  events={moreEventsTonight}
                  onEventClick={handleEventClick}
                  walkingMinByEventId={walkingMinByEventId}
                />
                {tonightAllEmpty && (
                  <section className="container py-12 md:py-16 text-center">
                    <ClosingBlock
                      message="That's it for tonight."
                      cta={{ label: "See what's on tomorrow →", onClick: () => setActiveDate("Tomorrow") }}
                    />
                  </section>
                )}
              </>
            );
          })()}

          {isTomorrow && (() => {
            const activeCategoryLabel = activeCategory
              ? categoriesData.find((c) => c.id === activeCategory)?.label ?? activeCategory
              : null;

            // Same flat-list short-circuit as tonight when a category
            // filter is active.
            if (activeCategoryLabel) {
              return (
                <DayList
                  // No title/counter — same reasoning as the tonight
                  // short-circuit above (sticky CategoryIconBar already
                  // surfaces the active category).
                  events={filtered}
                  onEventClick={handleEventClick}
                  emptyMessage={`No ${activeCategoryLabel} tomorrow.`}
                  onEmptyCta={{ label: "Clear filter →", onClick: () => handleCategoryChange("") }}
                  walkingMinByEventId={walkingMinByEventId}
                />
              );
            }

            const hasFreeTomorrow = tomorrowEvents.some((e) => isFreeOrDonation(e.entryInfo));
            const hasEditorialAbove =
              nearbyTomorrow.length > 0 || hasFreeTomorrow;
            const moreEventsTomorrow = filtered.filter(
              (e) =>
                !isFreeOrDonation(e.entryInfo) &&
                !nearbyTomorrowIds.has(e.id),
            );
            const tomorrowAllEmpty =
              nearbyTomorrow.length === 0 &&
              !hasFreeTomorrow &&
              moreEventsTomorrow.length === 0;
            return (
              <>
                <NearbyStrip
                  nearby={nearbyTomorrow}
                  onEventClick={handleEventClick}
                />
                <FreeTonightStrip
                  events={tomorrowEvents}
                  categories={categoriesData}
                  onEventClick={handleEventClick}
                  walkingMinByEventId={walkingMinByEventId}
                />
                <DayList
                  title={hasEditorialAbove ? "More events" : undefined}
                  /* Same dedup as More events tonight — drop free/donation
                     events and anything Nearby Tomorrow already surfaced,
                     so the master list reads as "what else is on tomorrow". */
                  events={moreEventsTomorrow}
                  onEventClick={handleEventClick}
                  walkingMinByEventId={walkingMinByEventId}
                />
                {/* No CTA (unlike tonight's "see tomorrow" handoff) — with
                    single-day chips there is no one obvious next view to
                    point at; the strip above holds the alternatives. */}
                {tomorrowAllEmpty && (
                  <section className="container py-12 md:py-16 text-center">
                    <ClosingBlock message="That's it for tomorrow." />
                  </section>
                )}
              </>
            );
          })()}

          {/* Weekday chips (day after tomorrow onwards) — a plain flat list,
              no editorial strips; the strip chip supplies the day context.
              Empty days stay selectable and show a calm empty state. */}
          {!isTonight && !isTomorrow && (() => {
            const activeCategoryLabel = activeCategory
              ? categoriesData.find((c) => c.id === activeCategory)?.label ?? activeCategory
              : null;
            return (
              <DayList
                events={filtered}
                onEventClick={handleEventClick}
                emptyMessage={
                  activeCategoryLabel
                    ? `No ${activeCategoryLabel} on this day.`
                    : "Nothing posted for this day yet."
                }
                onEmptyCta={
                  activeCategoryLabel
                    ? { label: "Clear filter →", onClick: () => handleCategoryChange("") }
                    : undefined
                }
                walkingMinByEventId={walkingMinByEventId}
              />
            );
          })()}
          </>
        )}
          </div>
          {/* Footer lives inside the scroll container so users reach it at
              the natural end of the feed. mt-auto pushes it flush to the
              scroll viewport's bottom edge when the list above is short.
              Native context has the BottomTabBar instead — Footer would
              crowd the bar and duplicate links. */}
          {!isNative && (
            <div className="mt-auto">
              <Footer />
            </div>
          )}
        </div>
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
  // word "More" lost its referent, and the DayStrip already supplies
  // the day context.
  title?: string;
  events: BarlinEvent[];
  onEventClick: (id: string) => void;
  // Empty-state message + CTA — shown only when events.length === 0.
  // Used by filtered short-circuits ("No Music tonight." / "Clear filter →")
  // where the messaging only makes sense when the slice is empty.
  // Unfiltered tonight/tomorrow pass no emptyMessage; the page-level
  // ClosingBlock above takes over when the whole day is empty.
  emptyMessage?: string;
  onEmptyCta?: { label: string; onClick: () => void };
  // When a card's event id appears in this map, the EventCard renders a
  // walking-distance chip in its meta row. Index passes a map covering all
  // events ≤ 15 min from the user — so a walkable event surfaces its chip
  // in this list even when the Nearby strip itself is collapsed (e.g. in
  // the category-filtered short-circuit).
  walkingMinByEventId?: Map<string, number>;
}

function DayList({ title, events, onEventClick, emptyMessage, onEmptyCta, walkingMinByEventId }: DayListProps) {
  // Empty state — only filtered short-circuits supply emptyMessage/onEmptyCta
  // ("No Music tonight." / "Clear filter →"). Unfiltered tonight/tomorrow
  // pass no emptyMessage and let the page-level ClosingBlock handle the
  // empty case, so a list with nothing in it just renders nothing here.
  if (events.length === 0) {
    if (emptyMessage) {
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
    return null;
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
          className="mb-2.5 sticky bg-background z-30"
          style={{ top: 0 }}
        >
          <div className="pt-2.5 pb-2.5 flex items-baseline gap-3.5 flex-wrap border-b-2 border-border">
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

interface ClosingBlockProps {
  message: string;
  cta?: { label: string; onClick: () => void };
}

function ClosingBlock({ message, cta }: ClosingBlockProps) {
  return (
    <>
      <p className="font-body italic text-[18px] m-0 text-foreground/80">{message}</p>
      {cta && (
        <button
          type="button"
          onClick={cta.onClick}
          className="mono-label text-accent border-b-2 border-accent pb-0.5 mt-3"
        >
          {cta.label}
        </button>
      )}
    </>
  );
}

