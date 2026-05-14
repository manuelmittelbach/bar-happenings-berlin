import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";
import EventCard from "@/components/events/EventCard";
import { PageSpinner } from "@/components/ui/page-spinner";
import { CategoryIconBar, CategoryRowPills } from "@/components/events/CategoryPill";
import TonightsHighlights from "@/components/events/TonightsHighlights";
import FreeTonightStrip from "@/components/events/FreeTonightStrip";
import StillRunningStrip from "@/components/events/StillRunningStrip";
import DaySwitcher, { type DayTab } from "@/components/events/DaySwitcher";
import AppHero from "@/components/landing/AppHero";
import { useIsNative } from "@/hooks/useIsNative";

import type { BarlinEvent } from "@/types/event";
import { useEvents, useCategories } from "@/hooks/useEvents";
import { isEventStillOnline } from "@/lib/eventStatus";
import { berlinDateString, berlinDateStringOffset } from "@/lib/dateFormat";
import { useFilterParams } from "@/lib/useFilterParams";
import { isFreeOrDonation } from "@/lib/entryInfo";

export const EXPLORE_SCROLL_KEY = "inside-bars-explore-scroll-y";

// Hero animation runs once per page-load; internal navigations skip it.
let heroAnimationPlayed = false;

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

  const handleDayTabChange = useCallback((t: DayTab) => {
    if (t === "tonight") setActiveDate("All");
    else if (t === "tomorrow") setActiveDate("Tomorrow");
    else setActiveDate("Later");
  }, [setActiveDate]);

  const isNative = useIsNative();
  const [animateHero] = useState(() => !heroAnimationPlayed);
  useEffect(() => {
    if (animateHero) heroAnimationPlayed = true;
  }, [animateHero]);

  const categoryBarRef = useRef<HTMLDivElement>(null);

  // Publish the actual category bar height as a CSS variable so the Later
  // section's sticky weekday header can stick exactly at the chrome's bottom
  // edge. A hardcoded top-[130px] guessed wrong on both breakpoints: desktop
  // pills render ~63px tall (chrome ends ~127px) and mobile icon discs render
  // ~103px tall (chrome ends ~167px). The mismatch left a hairline of cards
  // shimmering between the chrome's bottom rule and "Thu 14 May" on desktop,
  // and clipped the heading on mobile. ResizeObserver covers font swaps,
  // category counts changing, and orientation changes without remeasure code.
  useEffect(() => {
    const el = categoryBarRef.current;
    if (!el) return;
    const update = () => {
      document.documentElement.style.setProperty(
        "--chrome-bottom",
        `calc(var(--header-h) + ${el.offsetHeight}px)`,
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
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
  const todayEvents = useMemo(
    () =>
      eventsData.filter(
        (e) =>
          e.date === today &&
          isEventStillOnline(e) &&
          e.status !== "canceled" &&
          matchesFilters(e),
      ),
    [eventsData, today, matchesFilters],
  );
  const tomorrowEvents = useMemo(
    () =>
      eventsData.filter(
        (e) =>
          e.date === tomorrow &&
          e.status !== "canceled" &&
          matchesFilters(e),
      ),
    [eventsData, tomorrow, matchesFilters],
  );
  const highlightedTonightEvents = useMemo(
    () => todayEvents.filter((e) => e.isHighlight),
    [todayEvents],
  );
  // Yesterday's events that haven't reached their endTime / startTime+2h yet.
  // Only populated in the post-midnight window where cross-day events leak in.
  const stillRunningYesterday = useMemo(
    () =>
      eventsData
        .filter(
          (e) =>
            e.date === yesterday &&
            isEventStillOnline(e) &&
            e.status !== "canceled" &&
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

  const showEditorial = dayTab === "tonight";

  return (
    <div className="relative isolate">
      {!isNative && <AppHero animate={animateHero} />}

      {/* Sticky category filter — icon-disk row (mobile scroller / desktop
          row) matching /map. Opaque bg-background like the "More tonight"
          sticky header: when scrolling, event cards are cleanly hidden
          underneath instead of bleeding through blurred. The border-b
          hairline marks the bar's bottom edge. */}
      <div
        ref={categoryBarRef}
        className="sticky z-40 bg-background border-b border-border"
        style={{ top: "var(--header-h)" }}
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
          {showEditorial && (() => {
            // When a filter collapses every editorial strip above, the
            // list isn't "more than" anything — it's the entire tonight
            // surface. Switch the header from "More tonight" to "All
            // tonight" so the section still has a clear anchor instead
            // of an unlabeled list.
            const hasEditorialAbove =
              stillRunningYesterday.length > 0 ||
              highlightedTonightEvents.length > 0 ||
              todayEvents.some((e) => isFreeOrDonation(e.entryInfo));
            // With a category filter active, swap the generic "Nothing on
            // tonight" for the more useful "No <label> tonight" + a
            // "Change category" CTA that clears the filter. Without a
            // filter the original "See what's on tomorrow" CTA still
            // makes sense.
            const activeCategoryLabel = activeCategory
              ? categoriesData.find((c) => c.id === activeCategory)?.label ?? activeCategory
              : null;
            const tonightEmptyMessage = activeCategoryLabel
              ? `No ${activeCategoryLabel} tonight.`
              : "That's it for tonight.";
            const tonightEmptyCta = activeCategoryLabel
              ? { label: "Change category →", onClick: () => setActiveCategory("") }
              : { label: "See what's on tomorrow →", onClick: () => setActiveDate("Tomorrow") };
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
                <FreeTonightStrip
                  events={todayEvents}
                  categories={categoriesData}
                  onEventClick={handleEventClick}
                />
                <DayList
                  title={hasEditorialAbove ? "More tonight" : "All tonight"}
                  /* Dedup: drop events already shown above in Tonight's
                     Highlights (e.isHighlight) and Free Tonight (free or
                     pay-what-you-want). The master list reads as "what
                     else is on tonight" instead of repeating cards. */
                  events={filtered.filter(
                    (e) => !e.isHighlight && !isFreeOrDonation(e.entryInfo),
                  )}
                  onEventClick={handleEventClick}
                  emptyMessage={tonightEmptyMessage}
                  onEmptyCta={tonightEmptyCta}
                />
              </>
            );
          })()}

          {dayTab === "tomorrow" && (() => {
            const hasEditorialAbove = tomorrowEvents.some((e) => isFreeOrDonation(e.entryInfo));
            const activeCategoryLabel = activeCategory
              ? categoriesData.find((c) => c.id === activeCategory)?.label ?? activeCategory
              : null;
            const tomorrowEmptyMessage = activeCategoryLabel
              ? `No ${activeCategoryLabel} tomorrow.`
              : "That's it for tomorrow.";
            const tomorrowEmptyCta = activeCategoryLabel
              ? { label: "Change category →", onClick: () => setActiveCategory("") }
              : { label: "See what's on later →", onClick: () => setActiveDate("Later") };
            return (
              <>
                <FreeTonightStrip
                  events={tomorrowEvents}
                  categories={categoriesData}
                  onEventClick={handleEventClick}
                  title="Free tomorrow"
                />
                <DayList
                  title={hasEditorialAbove ? "More tomorrow" : "All tomorrow"}
                  /* Same dedup as More tonight — drop the free/donation
                     events that already render in Free Tomorrow above. */
                  events={filtered.filter((e) => !isFreeOrDonation(e.entryInfo))}
                  onEventClick={handleEventClick}
                  emptyMessage={tomorrowEmptyMessage}
                  onEmptyCta={tomorrowEmptyCta}
                />
              </>
            );
          })()}

          {dayTab === "later" && (
            <LaterAgenda
              events={filtered}
              onEventClick={handleEventClick}
            />
          )}
        </>
      )}

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
}

function DayList({ title, events, onEventClick, emptyMessage, onEmptyCta }: DayListProps) {
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
        // Sticky header — matches main's structure: sticky inside
        // .container, hairline on the inner heading row.
        <div
          className="sticky z-30 bg-background mb-3.5"
          style={{ top: "var(--chrome-bottom, 130px)" }}
        >
          <div className="border-b border-border pt-2.5 pb-2.5 flex items-baseline gap-3.5 flex-wrap -mx-6 px-6 md:mx-0 md:px-0">
            {/* Same size as the weekday separators in the Later section so all
                list headings ("More tonight", "Tomorrow", …) read at the
                same typographic weight. On narrow Mobile viewports the
                longer titles ("Free tomorrow", "More tomorrow") may wrap
                to two lines — that's acceptable, since keeping the
                day-anchor ("tomorrow") in each title gives users a
                context cue while scrolling past the DaySwitcher. */}
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
}

function LaterAgenda({ events, onEventClick }: LaterAgendaProps) {
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
    <div className="container py-6 md:py-8">
      {groups.map((g) => {
        const d = new Date(g.date + "T00:00:00");
        // Long weekday name on every viewport — matches "Tonight" /
        // "Tomorrow" labels in the day switcher, which are also fully
        // spelled out, so the visual rhythm stays consistent.
        const wdLong = d.toLocaleDateString("en-GB", { weekday: "long" });
        const dom = d.getDate();
        const mon = d.toLocaleDateString("en-GB", { month: "short" });
        return (
          <section key={g.date} className="mt-7 first:mt-0">
            <div
              className="sticky z-30 bg-background mb-3.5"
              style={{ top: "var(--chrome-bottom, 130px)" }}
            >
              <div className="border-b border-border pt-2.5 pb-2.5 flex items-baseline gap-3.5 flex-wrap -mx-6 px-6 md:mx-0 md:px-0">
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
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
