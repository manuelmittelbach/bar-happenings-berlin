import { useMemo } from "react";
import { Link } from "react-router-dom";
import { cleanEventTitle } from "@/lib/cleanTitle";
import EventMeta from "@/components/events/EventMeta";
import { isFreeEntry, isDonationEntry } from "@/lib/entryInfo";
import type { BarlinEvent } from "@/types/event";
import type { CategoryRow } from "@/lib/supabaseQueries";

interface FreeTonightStripProps {
  events: BarlinEvent[];
  categories: CategoryRow[];
  onEventClick: (eventId: string) => void;
  limit?: number;
  // Override the section title — defaults to "Free tonight" but the
  // Tomorrow tab reuses this component with "Free tomorrow".
  title?: string;
}

/* FreeTonight — wide cards with FREE / DONATION pill on the right.
 * Matches `EventCard.jsx` layout="free" from the design: 2px black border,
 * 24px body-bold title, mono meta (Now indicator + category + Free pill),
 * orange/cream pill at the right edge for the price tag.
 */
export default function FreeTonightStrip({
  events,
  categories,
  onEventClick,
  limit = 10,
  title = "Free tonight",
}: FreeTonightStripProps) {
  const freeEvents = useMemo(() => {
    return events
      .filter((e) => {
        if (e.status === "canceled") return false;
        return isFreeEntry(e.entryInfo) || isDonationEntry(e.entryInfo);
      })
      // Sorted purely by start time — the same chronological logic as
      // every other event list on the site, so the section reads
      // consistently. The Free vs Donation distinction is already
      // carried by the pill on each card, no need to bake it into the
      // sort order. Events without a start time fall to the end.
      .sort((a, b) => {
        const tA = a.startTime || "99:99";
        const tB = b.startTime || "99:99";
        return tA.localeCompare(tB);
      })
      .slice(0, limit);
  }, [events, limit]);

  if (freeEvents.length === 0) return null;

  return (
    <section>
      {/* Nur pt — die folgende Section (DayList "More tonight" / "More
          tomorrow") bringt ihr eigenes pt-6 mit, also würden zwei
          gestapelte py den Abstand doppelt machen. So bleibt der Spacing
          zwischen FreeTonight-Cards und dem nächsten Header genauso
          groß wie zwischen DaySwitcher und FreeTonight-Header. */}
      <div className="container py-6 md:py-8">
        {/* Inline section header — runs borderless so the heading sits in
            quiet whitespace. A sticky+hairline variant felt busy when
            stacked on top of the day+category chrome. */}
        <div className="mb-2.5">
          <div className="pt-2.5 flex items-baseline gap-3.5 flex-wrap">
            <h2 className="heading-display text-2xl md:text-[30px] leading-none m-0">
              {title}
            </h2>
            <span className="flex-1" />
            {/* Counter — auf Mobile nur die Zahl, auf Desktop „N Free"
                als knappe Charakterisierung (ohne „events"-Suffix, das
                redundant zum Section-Title wäre). */}
            <span className="mono-label text-muted-foreground">
              <span className="md:hidden">{freeEvents.length}</span>
              <span className="hidden md:inline">
                {freeEvents.length} Free
              </span>
            </span>
          </div>
        </div>

        {/* Mobile: vertical stack (one card per row) so nothing hides
            behind a swipe gesture. Desktop: responsive grid so the
            available horizontal space isn't wasted on a single-column
            list of wide cards. */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {freeEvents.map((event) => (
            <FreeCard
              key={event.id}
              event={event}
              categories={categories}
              onClick={onEventClick}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

interface FreeCardProps {
  event: BarlinEvent;
  categories: CategoryRow[];
  onClick: (eventId: string) => void;
}

function FreeCard({ event, categories, onClick }: FreeCardProps) {
  const displayTitle = cleanEventTitle(event.title, event.venue);
  const isCanceled = event.status === "canceled";

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick(event.id);
  };

  return (
    <Link
      to={`/event/${event.id}`}
      onClick={handleClick}
      className={`relative group flex flex-col h-full px-4 md:px-5 py-4 md:py-[18px] bg-background border-2 border-foreground hover:border-accent transition-all no-underline text-foreground shadow-[0_18px_40px_-28px_hsla(18,85%,52%,0.3)] hover:shadow-[0_22px_50px_-28px_hsla(18,85%,52%,0.4)] ${
        isCanceled ? "opacity-50" : ""
      }`}
    >
      {/* Meta row renders the small Free/Donation pill inline — matches
          the treatment in TonightsHighlights cards. The previous big
          accent pill anchored top-right was visually heavier than the
          rest of the card chrome. */}
      <div className="min-w-0">
        <EventMeta event={event} categories={categories} size="md" />
      </div>
      <h3
        lang="de"
        className={`font-body text-[22px] md:text-[24px] font-bold leading-[1.2] mt-2 mb-0 hyphens-auto break-words ${
          isCanceled ? "line-through" : ""
        }`}
      >
        {displayTitle}
      </h3>
      {/* Venue · neighborhood — line-clamp-2 lets long venue names wrap
          over two lines before they truncate, instead of clipping with
          an ellipsis on a single line (which on narrow desktop-grid
          cells hid the neighborhood entirely). */}
      <div className="font-body text-[13px] text-muted-foreground mt-1 line-clamp-2">
        {event.venue}
        {event.neighborhood ? ` · ${event.neighborhood}` : ""}
      </div>
    </Link>
  );
}
