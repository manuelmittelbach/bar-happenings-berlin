import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Search, X } from "lucide-react";
import { useVenues } from "@/hooks/useEvents";
import { addSoftHyphens } from "@/lib/cleanTitle";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";
import { ALL_NEIGHBORHOODS } from "@/lib/neighborhoodFromAddress";
import { PageSpinner } from "@/components/ui/page-spinner";
import type { Venue } from "@/types/event";

/* BarsList — directory of every venue in the database. Two filters
 * sit between the masthead and the index: a fuzzy bar-name search and
 * a neighborhood pill row (only neighborhoods that actually have bars
 * appear, sorted by bar count). Both narrow the same grouped A-Z grid
 * below. Cards link straight through to /bar/:id — the same
 * destination as tapping the venue line on EventDetailView, so the
 * detail surface is shared.
 */
export default function BarsList() {
  const { data: venues = [], isLoading } = useVenues();
  const [nameQuery, setNameQuery] = useState("");
  const [activeHood, setActiveHood] = useState("");

  // Hood pill order is locked to the unfiltered dataset so the row
  // doesn't reshuffle as the user types. Sort is one-time: by total
  // bar count (busiest first), then alphabetical for ties; empty hoods
  // sink to the bottom. Recomputes only when the underlying venues
  // list changes.
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

  // Live counts per hood reflect the current name-search (but NOT the
  // active hood — otherwise picking a hood would zero out all sibling
  // counts). Overlaid onto the locked `hoodOrder` so labels update
  // live while positions stay stable.
  const neighborhoods = useMemo(() => {
    const pool = nameQuery.trim()
      ? venues.filter((v) => fuzzyMatchAny([v.name], nameQuery))
      : venues;
    const liveCounts = new Map<string, number>();
    for (const v of pool) {
      const h = (v.neighborhood || "").trim();
      if (!h) continue;
      liveCounts.set(h, (liveCounts.get(h) || 0) + 1);
    }
    return hoodOrder.map(({ name }) => ({
      name,
      count: liveCounts.get(name) || 0,
    }));
  }, [hoodOrder, venues, nameQuery]);

  // Filter pass — fuzzy match on name (same helper as Index/Map search
  // so the "ä/ö/typo" behavior reads consistent across surfaces), then
  // exact-match neighborhood. Empty filters are no-ops.
  const filtered = useMemo(() => {
    let result = venues;
    if (nameQuery.trim()) {
      result = result.filter((v) => fuzzyMatchAny([v.name], nameQuery));
    }
    if (activeHood) {
      result = result.filter((v) => v.neighborhood === activeHood);
    }
    return result;
  }, [venues, nameQuery, activeHood]);

  // Group alphabetically. Letter dividers give the directory a magazine-
  // index rhythm and make long lists scannable without adding more chrome.
  const grouped = useMemo(() => {
    const sorted = [...filtered].sort((a, b) =>
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
    );
    const out: { letter: string; items: Venue[] }[] = [];
    for (const v of sorted) {
      const letter = (v.name[0] || "#").toUpperCase().match(/[A-Z]/)
        ? (v.name[0] || "#").toUpperCase()
        : "#";
      const last = out[out.length - 1];
      if (last && last.letter === letter) last.items.push(v);
      else out.push({ letter, items: [v] });
    }
    return out;
  }, [filtered]);

  const clearAll = () => {
    setNameQuery("");
    setActiveHood("");
  };

  // Explicit view selector — three mutually exclusive screens. Using
  // boolean flags + separate `&&` blocks (instead of a nested ternary)
  // makes it impossible for the empty state and the cards grid to
  // render side by side, even under HMR / partial-update edge cases.
  const showNoDirectory = venues.length === 0;
  const showNoMatch = !showNoDirectory && filtered.length === 0;
  const showResults = !showNoDirectory && !showNoMatch;

  if (isLoading) return <PageSpinner />;

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

      <div className="container max-w-[1100px] pt-10 md:pt-14">
        {/* Masthead — mono eyebrow over serif display title, mirroring
            EventDetail / BarDetail typography hierarchy. Count gives the
            directory immediate scale without needing chrome. */}
        {/* Filter row — bar-name search input + neighborhood pill bar.
            Sits below the masthead and above the index, so users see
            scope before they scan. Editorial shape system: the input
            gets rounded-xl, neighborhood pills are sharp (border-2,
            rounded-none) on desktop and rounded-full on mobile to stay
            consistent with the category-filter shape rule. */}
        <div className="mb-8 md:mb-10 space-y-3">
          {/* Search by bar — fuzzy text input with leading icon. Clear
              button appears once the user has typed something. */}
          <label className="relative block w-full md:max-w-sm">
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
              className="w-full h-10 pl-10 pr-10 bg-card border-2 border-foreground rounded-xl font-body text-[14px] outline-none focus:shadow-[0_0_0_3px_hsla(18,85%,52%,0.15)] transition-shadow placeholder:text-muted-foreground/70 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
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

          {/* Search by neighborhood — wraps across multiple rows so
              every hood is visible at once, no horizontal scroll. "All"
              sits first as the implicit clear. Counts shown in mono to
              read as metadata, not part of the label. Pills are sharp
              on desktop (border-2, rounded-none) and round on mobile
              (rounded-full) per the existing filter shape system. */}
          {neighborhoods.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <HoodPill
                label="All"
                active={!activeHood}
                onClick={() => setActiveHood("")}
              />
              {neighborhoods.map((h) => (
                <HoodPill
                  key={h.name}
                  label={h.name}
                  count={h.count}
                  active={activeHood === h.name}
                  disabled={h.count === 0}
                  onClick={() => setActiveHood(activeHood === h.name ? "" : h.name)}
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
          // Empty state — matches the Index "No Drag tonight." pattern
          // (italic body line + mono-label accent CTA underlined) so
          // every "filtered to nothing" surface across the site reads
          // the same.
          <section className="py-12 md:py-16 text-center">
            <p className="font-body italic text-[18px] m-0">
              No bars match
              {nameQuery.trim() && <> "{nameQuery.trim()}"</>}
              {activeHood && (
                <>
                  {nameQuery.trim() ? " in " : " in "}
                  {activeHood}
                </>
              )}
              .
            </p>
            <button
              type="button"
              onClick={clearAll}
              className="mono-label text-accent border-b-2 border-accent pb-0.5 mt-3"
            >
              Reset filters →
            </button>
          </section>
        )}

        {showResults && (
          <div className="space-y-12 md:space-y-14">
            {grouped.map((group) => (
              <section key={group.letter}>
                {/* Letter divider — full-width hairline + giant serif
                    initial. Reads as a magazine index break, not a UI
                    chip, and holds its own without competing with the
                    masthead. */}
                <div className="flex items-baseline gap-5 border-t-2 border-foreground pt-3 mb-5 md:mb-7">
                  <span className="font-serif font-bold leading-none text-[40px] md:text-[52px]">
                    {group.letter}
                  </span>
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    {group.items.length} {group.items.length === 1 ? "bar" : "bars"}
                  </span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 md:gap-4">
                  {group.items.map((v) => (
                    <BarCard key={v.id} venue={v} />
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

/* HoodPill — neighborhood filter chip. Sharp 2px-bordered rectangle on
 * desktop (md:rounded-none) and a round pill on mobile (rounded-full)
 * to match the existing category-filter shape system across the app.
 * The bar count rides in mono inside the pill so the label reads as a
 * filter, not just a tag. */
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
  // Three states: active (filled), idle (outlined, hoverable), and
  // empty (no bars in this hood yet) — empty pills stay in the row so
  // the directory reads as a complete map of Berlin, but they're
  // visually de-emphasized and non-interactive.
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

/* BarCard — sharp 2px-bordered editorial card. Image lede on top,
 * neighborhood eyebrow + serif name + address below. Hover lifts the
 * card with a warm orange shadow that matches the radial atmosphere of
 * the page. Whole card is the link target so the affordance reads at a
 * glance and the touch hit-area is generous on mobile. */
function BarCard({ venue }: { venue: Venue }) {
  const cleanAddress = venue.address?.replace(/,\s*(Germany|Deutschland)\s*$/i, "") ?? "";
  const initials = venue.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <Link
      to={`/bar/${venue.id}`}
      className="group block bg-background border-2 border-foreground hover:border-accent transition-all overflow-hidden no-underline text-foreground shadow-[0_18px_40px_-28px_hsla(18,85%,52%,0.3)] hover:shadow-[0_22px_50px_-28px_hsla(18,85%,52%,0.4)]"
    >
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
          // No-image fallback — initials in serif on a warm tinted
          // panel. Keeps the grid rhythm even when a bar has no photo
          // yet, instead of an empty grey placeholder.
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, hsla(28, 85%, 55%, 0.18), hsla(18, 85%, 52%, 0.08) 70%)",
            }}
          >
            <span className="font-serif font-bold text-[64px] leading-none text-foreground/40">
              {initials || "·"}
            </span>
          </div>
        )}
        {venue.neighborhood && (
          // Neighborhood badge — sits on top of the image, top-left.
          // Dark foreground fill + primary-foreground text reads as a
          // hand-applied stamp on the photo, gives the image something
          // editorial to anchor without needing a caption row.
          <span
            className="absolute left-3 top-3 inline-flex items-center gap-1 bg-foreground text-primary-foreground px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em]"
          >
            <MapPin className="h-3 w-3" />
            {venue.neighborhood}
          </span>
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
          <p className="mt-1.5 font-body text-[13px] leading-[1.5] text-foreground/80 line-clamp-1 break-words">
            {cleanAddress}
          </p>
        )}
      </div>
    </Link>
  );
}
