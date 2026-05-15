import { Link } from "react-router-dom";
import { cleanEventTitle } from "@/lib/cleanTitle";
import EventCard from "@/components/events/EventCard";
import EventMeta from "@/components/events/EventMeta";
import { useCategories } from "@/hooks/useEvents";
import type { BarlinEvent } from "@/types/event";

interface NearbyStripProps {
  // Pre-computed nearest-first list of {event, walking minutes}. Computed
  // in Index.tsx (not here) so the same list can drive "More tonight"
  // dedupe — keeping it pure-input means no walking math is duplicated.
  nearby: { event: BarlinEvent; min: number }[];
  onEventClick: (eventId: string) => void;
  // Default "Nearby tonight"; Tomorrow tab passes "Nearby tomorrow".
  title?: string;
  // Surfaced in the desktop counter copy ("N within 15 min"). Mirrored
  // from the value Index passed to computeNearbyEvents so the chrome
  // and the cutoff don't drift out of sync.
  maxWalkingMin?: number;
}

/* NearbyStrip — events at walkable distance from the user's location.
 * Mirrors FreeTonightStrip structurally:
 *   - Mobile: flat EventCard list rows (matches the rest of the mobile feed).
 *   - Desktop: responsive grid of NearbyCard (mirrors FreeCard's chrome —
 *     2px black border, soft shadow, padded meta + title + venue + walking).
 * Caller is responsible for only rendering when location is available and
 * the list isn't empty.
 */
export default function NearbyStrip({
  nearby,
  onEventClick,
  title = "Nearby tonight",
  maxWalkingMin = 30,
}: NearbyStripProps) {
  const { data: categories = [] } = useCategories();

  if (nearby.length === 0) return null;

  return (
    <section>
      <div className="container py-6 md:py-8">
        {/* Sticky on mobile, static on desktop — same chrome as the other
            section headers (FreeTonightStrip, StillRunningStrip, DayList). */}
        <div
          className="mb-2.5 sticky bg-background z-30"
          style={{ top: 0 }}
        >
          <div className="pt-2.5 pb-2.5 flex items-baseline gap-3.5 flex-wrap border-b-2 border-border">
            <h2 className="heading-display text-2xl md:text-[30px] leading-none m-0">
              {title}
            </h2>
            <span className="flex-1" />
            <span className="mono-label text-muted-foreground">
              <span className="md:hidden">{nearby.length}</span>
              <span className="hidden md:inline">
                {nearby.length} within {maxWalkingMin} min
              </span>
            </span>
          </div>
        </div>

        {/* Mobile: flat list rows — Nearby is sorted by distance, so a
            single-column list reads cleanly "closest → farthest". */}
        <div className="md:hidden">
          {nearby.map(({ event, min }) => (
            <EventCard
              key={event.id}
              event={event}
              layout="list"
              onClick={onEventClick}
              walkingMin={min}
            />
          ))}
        </div>

        {/* Desktop: bordered card grid mirroring Free tonight's treatment.
            The wider viewport has room for a multi-column grid, and matching
            FreeCard's chrome keeps the editorial rhythm consistent between
            the two strips. */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {nearby.map(({ event, min }) => (
            <NearbyCard
              key={event.id}
              event={event}
              walkingMin={min}
              categories={categories}
              onClick={onEventClick}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

interface NearbyCardProps {
  event: BarlinEvent;
  walkingMin: number;
  categories: ReturnType<typeof useCategories>["data"];
  onClick: (eventId: string) => void;
}

/* NearbyCard — desktop grid card. Same border/shadow chrome as FreeCard
 * so the two strips share a visual family; the only differentiator is
 * the walking-distance chip baked into the EventMeta row. */
function NearbyCard({ event, walkingMin, categories, onClick }: NearbyCardProps) {
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
      <div className="min-w-0">
        <EventMeta event={event} categories={categories ?? []} size="md" walkingMin={walkingMin} />
      </div>
      <h3
        lang="de"
        className={`font-body text-[22px] md:text-[24px] font-bold leading-[1.2] mt-2 mb-0 hyphens-auto break-words ${
          isCanceled ? "line-through" : ""
        }`}
      >
        {displayTitle}
      </h3>
      <div className="font-body text-[13px] text-muted-foreground mt-1 line-clamp-2">
        {event.venue}
        {event.neighborhood ? ` · ${event.neighborhood}` : ""}
      </div>
    </Link>
  );
}
