import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Shuffle, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useVenues, useEvents } from "@/hooks/useEvents";
import { setVenueActiveImage } from "@/lib/supabaseQueries";
import { addSoftHyphens } from "@/lib/cleanTitle";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";
import { isEventStillOnline } from "@/lib/eventStatus";
import { berlinDateString } from "@/lib/dateFormat";
import { ALL_NEIGHBORHOODS } from "@/lib/neighborhoodFromAddress";
import { PageSpinner } from "@/components/ui/page-spinner";
import { ErrorState } from "@/components/ui/error-state";
import FadeInImage from "@/components/ui/FadeInImage";
import type { Venue, BarlinEvent } from "@/types/event";

// Bars-page filter persistence. Lives in sessionStorage so bar-card →
// bar detail → back keeps the filter the user dialled in. Mirrors the
// reload-clear pattern in useFilterParams (module-top removeItem runs
// on real reloads, SPA navigation leaves it intact). Kept in a private
// namespace (bars_*) so it doesn't leak into the shared Events/Map
// filter slot — that separation is intentional, see the comment on the
// state hooks below.
const BARS_Q_KEY = "bars_q";
const BARS_HOOD_KEY = "bars_hood";
if (typeof sessionStorage !== "undefined") {
  sessionStorage.removeItem(BARS_Q_KEY);
  sessionStorage.removeItem(BARS_HOOD_KEY);
}

/* BarsList — directory of every venue, grouped by neighborhood.
 *
 * Hoods are ordered LIVE by how many of their bars have something
 * happening tonight: busiest hood first, quiet hoods at the bottom.
 * That turns the directory from a static phone book into a "where in
 * Berlin is something on right now" lens that complements the map
 * (spatial) and the events list (chronological).
 *
 * Each card carries a tiny mono signal line when the bar has at least
 * one event tonight. That line is its own click target — exactly-one
 * event jumps straight to the event page, multiple events deepen to
 * the bar page where they're all listed. The rest of the card always
 * links to bar detail.
 */
export default function BarsList() {
  // useAuth is per-component state (NOT a context), so calling it inside
  // every BarCard would mean 200 parallel role-fetches racing each
  // other — and admin-bars appearing on whichever cards happen to
  // resolve first. Call it ONCE at the page level, pass isAdmin down.
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const {
    data: venues = [],
    isLoading: venuesLoading,
    isError: venuesError,
    refetch: refetchVenues,
    isFetching: venuesFetching,
  } = useVenues();
  // All upcoming events. Same hook the Index page uses, so the shared
  // cache means switching Events ↔ Bars doesn't refetch.
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  // Name + neighborhood filters are LOCAL to the bars page. Picking
  // a hood here should not leak to Events/Map — those surfaces have
  // their own discovery logic, and a stray "Kreuzberg" filter
  // following the user there would silently hide most of what they
  // came to see. State is mirrored to a private sessionStorage slot
  // so card → bar detail → back preserves the filter; clears on full
  // reload via the module-top removeItem block.
  const [nameQuery, setNameQuery] = useState(() =>
    typeof sessionStorage !== "undefined" ? sessionStorage.getItem(BARS_Q_KEY) ?? "" : "",
  );
  const [activeNeighborhood, setActiveNeighborhood] = useState(() =>
    typeof sessionStorage !== "undefined" ? sessionStorage.getItem(BARS_HOOD_KEY) ?? "" : "",
  );

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    if (nameQuery) sessionStorage.setItem(BARS_Q_KEY, nameQuery);
    else sessionStorage.removeItem(BARS_Q_KEY);
  }, [nameQuery]);

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    if (activeNeighborhood) sessionStorage.setItem(BARS_HOOD_KEY, activeNeighborhood);
    else sessionStorage.removeItem(BARS_HOOD_KEY);
  }, [activeNeighborhood]);

  const today = berlinDateString();

  // Tonight's events grouped by venueId. Drives the per-card signal
  // line and the live hood ordering. Sorted by start time so the
  // earliest event surfaces first when there's only one to display.
  const eventsTonightByVenue = useMemo(() => {
    const map = new Map<string, BarlinEvent[]>();
    for (const e of events) {
      if (e.date !== today) continue;
      if (e.status === "canceled") continue;
      if (!isEventStillOnline(e)) continue;
      if (!e.venueId) continue;
      const list = map.get(e.venueId) || [];
      list.push(e);
      map.set(e.venueId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) =>
        (a.startTime || "99:99").localeCompare(b.startTime || "99:99"),
      );
    }
    return map;
  }, [events, today]);

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

  // Live counts per hood for the pill row. The displayed count is the
  // TOTAL number of bars in the hood under the current name search,
  // matching the per-hood section-header counter so pill and header
  // speak the same vocabulary. Counts react to name-search but not to
  // the active hood (otherwise picking a hood would zero out every
  // sibling).
  const neighborhoods = useMemo(() => {
    const pool = nameQuery.trim()
      ? venues.filter((v) => fuzzyMatchAny([v.name], nameQuery))
      : venues;
    const barCounts = new Map<string, number>();
    for (const v of pool) {
      const h = (v.neighborhood || "").trim();
      if (!h) continue;
      barCounts.set(h, (barCounts.get(h) || 0) + 1);
    }
    return hoodOrder.map(({ name }) => ({
      name,
      count: barCounts.get(name) || 0,
      hasBars: (barCounts.get(name) || 0) > 0,
    }));
  }, [hoodOrder, venues, nameQuery]);

  // Group venues by neighborhood, then sort hoods by tonight-activity.
  // Within each hood:
  //   1. Bars with events tonight come first, sorted by earliest
  //      start time ascending (bars without a known start time go to
  //      the END of this tonight-active group).
  //   2. The rest follow, alphabetical, case-insensitive.
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

    const earliestStart = (id: string): string | null => {
      const list = eventsTonightByVenue.get(id);
      if (!list || list.length === 0) return null;
      for (const e of list) {
        if (e.startTime) return e.startTime;
      }
      return null;
    };

    return [...groups.entries()]
      .map(([name, items]) => {
        const sorted = [...items].sort((a, b) => {
          const aHas = (eventsTonightByVenue.get(a.id)?.length || 0) > 0;
          const bHas = (eventsTonightByVenue.get(b.id)?.length || 0) > 0;
          if (aHas !== bHas) return aHas ? -1 : 1;
          if (aHas && bHas) {
            // Both have tonight events: earliest startTime first;
            // unknown start times sink to the bottom of this group.
            const aTime = earliestStart(a.id);
            const bTime = earliestStart(b.id);
            if (aTime !== null && bTime === null) return -1;
            if (aTime === null && bTime !== null) return 1;
            if (aTime !== null && bTime !== null && aTime !== bTime) {
              return aTime.localeCompare(bTime);
            }
            // Same (or both unknown) → tiebreak by name.
            return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
          }
          // Neither has tonight events → alphabetical.
          return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
        });
        const dayBars = sorted.filter(
          (v) => (eventsTonightByVenue.get(v.id)?.length || 0) > 0,
        ).length;
        return { name, items: sorted, dayBars };
      })
      .sort((a, b) => {
        if (a.name === "Other") return 1;
        if (b.name === "Other") return -1;
        // Primary: hoods with tonight activity first.
        if (a.dayBars !== b.dayBars) return b.dayBars - a.dayBars;
        // Secondary: by total bar count (denser hood breaks ties).
        if (a.items.length !== b.items.length) return b.items.length - a.items.length;
        return a.name.localeCompare(b.name);
      });
  }, [filteredVenues, eventsTonightByVenue]);

  // Mark the first 6 cards (in document order across all hoods) as
  // high-priority so the browser fetches them eagerly with elevated
  // priority instead of waiting for lazy loading. Everything after that
  // stays lazy. Mobile typically shows ~4 cards above the fold, desktop
  // ~6, so 6 covers both with a small read-ahead buffer.
  const priorityVenueIds = useMemo(() => {
    const ids = new Set<string>();
    let count = 0;
    for (const hood of hoods) {
      for (const v of hood.items) {
        if (count < 6) ids.add(v.id);
        count++;
      }
    }
    return ids;
  }, [hoods]);

  // Masthead counter — always the unfiltered total. The page header
  // reads "All bars · N", a fixed total no matter what filters the
  // user has dialled in; per-hood counters below reflect the filtered
  // view.
  const totalBars = venues.length;

  const showNoDirectory = venues.length === 0;
  const showNoMatch = !showNoDirectory && filteredVenues.length === 0;
  const showResults = !showNoDirectory && !showNoMatch;

  if (venuesLoading || eventsLoading) return <PageSpinner />;

  // The directory query failed and nothing is cached — show a retry surface
  // rather than "No bars in the directory yet.", which would falsely claim
  // the directory is empty when the fetch never landed.
  if (venuesError && venues.length === 0) {
    return (
      <ErrorState
        message="Couldn't load the bar directory. Check your connection and try again."
        onRetry={() => refetchVenues()}
        isRetrying={venuesFetching}
        homeLink
      />
    );
  }

  return (
    <div className="bg-background pb-24">
      <div className="container pt-4 md:pt-6">
        {/* Masthead — heading-display 24/30px under a hairline rule
            with a bar-count on the right. Static count of bars under
            the current filters; no day signal here (per-card lines
            carry tonight activity). */}
        <header className="mb-6 md:mb-8">
          <div className="pt-2.5 pb-2.5 flex items-baseline gap-3.5 flex-wrap border-b-2 border-border">
            <h1 className="heading-display text-2xl md:text-[30px] leading-none m-0">
              All bars
            </h1>
            <span className="flex-1" />
            <span className="mono-label text-muted-foreground">
              <span className="md:hidden">{totalBars}</span>
              <span className="hidden md:inline">
                {totalBars} bar{totalBars !== 1 ? "s" : ""}
              </span>
            </span>
          </div>
        </header>

        {/* Filter row — name search + neighborhood pills, both always
            visible. Previously two collapsible toggles, but that
            hid the filters behind an extra click for no real gain:
            the chrome above already establishes the page's "all
            bars" identity, and the filters are the point of this
            row. Day filter sits in the top chrome above. */}
        <div className="mb-8 md:mb-10 space-y-4">
          <label className="relative block w-full">
            <span className="sr-only">Search bars by name</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            />
            <input
              type="search"
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

          {/* Neighborhood pill grid — every hood visible at once, no
              expand step. Same shape system as the category pills on
              Events/Map: sharp 2px-bordered on desktop, round on
              mobile. The count is bars-with-events on the selected
              day; empty hoods (no bars under the current name search)
              read disabled. */}
          {neighborhoods.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
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
          )}
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
                    <span className="mono-label text-muted-foreground">
                      <span className="md:hidden">{hood.items.length}</span>
                      <span className="hidden md:inline">
                        {hood.items.length} bar{hood.items.length !== 1 ? "s" : ""}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 md:gap-4">
                  {hood.items.map((v) => (
                    <BarCard
                      key={v.id}
                      venue={v}
                      tonightEvents={eventsTonightByVenue.get(v.id) || []}
                      priority={priorityVenueIds.has(v.id)}
                      isAdmin={isAdmin}
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

/* BarCard — sharp 2px-bordered editorial card. Image lede on top, bar
 * name below. When the bar has events tonight, a small mono signal
 * line sits under the name as its own click target.
 *
 * Implementation: the outer wrapper is an <article>. A bare <Link>
 * absolutely covers the whole card at z-0 (the default whole-card
 * affordance). The signal line is a separately-stacked <Link> with
 * `relative z-10` so its hit area sits ABOVE the cover link. Visual
 * content sits between with pointer-events-none so clicks fall through
 * to whichever link owns the pixel under the cursor. The article
 * carries `group` so group-hover styles on the title still fire when
 * the user hovers anywhere on the card. */
// Quiet editorial placeholder for venues with no image — and the fallback
// shown when an image fails to load after a retry. Warm radial tint, hairline
// crosshairs, 8px accent dot, mono "Inside · Bars" caption in the corner.
function BarImagePlaceholder() {
  return (
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
  );
}

function BarCard({
  venue,
  tonightEvents,
  priority = false,
  isAdmin = false,
}: {
  venue: Venue;
  tonightEvents: BarlinEvent[];
  priority?: boolean;
  isAdmin?: boolean;
}) {
  const queryClient = useQueryClient();
  const [swapping, setSwapping] = useState(false);

  // Identify which archived source the live `image` currently points to.
  // "other" covers manual uploads or images set before the og/google
  // columns existed — they're left alone unless the admin swaps.
  const currentSource: "og" | "google" | "other" =
    venue.image && venue.image === venue.imageOg
      ? "og"
      : venue.image && venue.image === venue.imageGoogle
        ? "google"
        : "other";
  const targetSource: "og" | "google" =
    currentSource === "og" ? "google" : "og";
  const targetUrl =
    targetSource === "google" ? venue.imageGoogle : venue.imageOg;
  const canSwap = !!targetUrl && targetUrl !== venue.image;

  const handleSwap = async (e: React.MouseEvent) => {
    // Stop the click from bubbling to the card cover Link below.
    e.preventDefault();
    e.stopPropagation();
    if (!targetUrl || swapping) return;
    setSwapping(true);
    try {
      await setVenueActiveImage(venue.id, targetUrl);
      await queryClient.invalidateQueries({ queryKey: ["venues"] });
      toast.success(
        `${venue.name}: switched to ${targetSource === "google" ? "Google" : "OG"}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Swap failed";
      toast.error(msg);
    } finally {
      setSwapping(false);
    }
  };

  const cleanAddress = venue.address?.replace(/,\s*(Germany|Deutschland)\s*$/i, "") ?? "";
  const hasTonightEvents = tonightEvents.length > 0;
  // Single-event: deep-link to the event. Multi-event: deepen to the
  // bar page (where all upcoming events sit at top), since there's no
  // single event to jump to.
  const signalHref =
    tonightEvents.length === 1
      ? `/event/${tonightEvents[0].id}`
      : `/bar/${venue.id}`;
  const signalLabel =
    tonightEvents.length === 1
      ? `Tonight${tonightEvents[0].startTime ? ` · ${tonightEvents[0].startTime}` : ""}`
      : `${tonightEvents.length} events tonight`;

  return (
    <article className="group relative bg-background border-2 border-foreground hover:border-accent transition-all overflow-hidden shadow-[0_18px_40px_-28px_hsla(18,85%,52%,0.3)] hover:shadow-[0_22px_50px_-28px_hsla(18,85%,52%,0.4)]">
      {/* Admin-only image-source toggle. Sits OUTSIDE the cover-link area
          (the Link below only covers the visual block), so the button is
          a normal in-flow interactive element with its own hit area. */}
      {isAdmin && (venue.imageOg || venue.imageGoogle) && (
        <div className="relative z-20 flex items-center justify-between gap-2 border-b-2 border-foreground bg-muted/60 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          <span className="truncate">
            src · <span className="text-foreground">{currentSource === "other" ? "manual" : currentSource}</span>
          </span>
          <button
            type="button"
            onClick={handleSwap}
            disabled={!canSwap || swapping}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 border-2 border-foreground bg-background text-foreground hover:bg-foreground hover:text-background active:scale-95 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-background disabled:hover:text-foreground"
          >
            <Shuffle className="h-3 w-3" />
            {swapping ? "…" : `→ ${targetSource === "google" ? "Google" : "OG"}`}
          </button>
        </div>
      )}

      {/* Cover link + visual content wrapper. The Link is absolute inside
          this wrapper, so it only covers the image + meta below — not the
          admin bar above. */}
      <div className="relative">
        <Link
          to={`/bar/${venue.id}`}
          aria-label={venue.name}
          className="absolute inset-0 z-0"
        />

      {/* Visual content — pointer-events-none so clicks fall through. */}
      <div className="relative pointer-events-none">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted border-b-2 border-foreground">
          {venue.image ? (
            <FadeInImage
              src={venue.image}
              alt={venue.name}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "auto"}
              objectPosition={venue.imagePosition || undefined}
              className="absolute inset-0 w-full h-full object-cover transition-[opacity,transform] duration-500 group-hover:scale-[1.03]"
              fallback={<BarImagePlaceholder />}
            />
          ) : (
            <BarImagePlaceholder />
          )}
        </div>
        <div className="p-4 md:p-5">
          <h3
            lang="de"
            className="font-body text-[17px] md:text-[22px] font-bold leading-[1.2] m-0 transition-colors group-hover:text-accent break-words hyphens-auto"
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

      {/* Tonight signal line — its own Link, stacked above the cover.
          Pulsing accent dot mirrors the live "Now" indicator in
          EventMeta, tying the directory back to the events page
          vocabulary. */}
      {hasTonightEvents && (
        <div className="relative z-10 px-4 md:px-5 pb-4 md:pb-5 -mt-1 md:-mt-1.5">
          <Link
            to={signalHref}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] font-bold text-accent hover:text-foreground transition-colors"
            aria-label={
              tonightEvents.length === 1
                ? `${signalLabel} at ${venue.name}: ${tonightEvents[0].title}`
                : `${tonightEvents.length} events tonight at ${venue.name}`
            }
          >
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse"
            />
            {signalLabel}
          </Link>
        </div>
      )}
      </div>
    </article>
  );
}
