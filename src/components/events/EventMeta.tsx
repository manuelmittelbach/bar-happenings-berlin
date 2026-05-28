import { isLiveNow } from "@/lib/eventStatus";
import { isFreeEntry, isDonationEntry } from "@/lib/entryInfo";
import type { BarlinEvent } from "@/types/event";
import type { CategoryRow } from "@/lib/supabaseQueries";

interface EventMetaProps {
  event: BarlinEvent;
  categories: CategoryRow[];
  // Slightly larger mono in the wide "free" variant
  size?: "sm" | "md";
  // When set, render an accent-colored walking-distance chip at the end of
  // the row (e.g. "6 min"). Set by the Nearby strip on the index page; left
  // undefined elsewhere so existing cards stay untouched.
  walkingMin?: number;
}

/* EventMeta — the time · category · FREE/DONATION/Canceled row shared by
 * every card variant in the design. Strict translation of `EventCard.jsx`
 * meta block: 10–11px mono uppercase tracked 0.08em, with the time slot
 * replaced by a pulsing orange "Now" when the event is currently live.
 *
 * Temporal "Soon / Over / Might be over" badges were removed per the
 * design — only the Now indicator and the static category/price pills
 * remain. */
export default function EventMeta({ event, categories, size = "sm", walkingMin }: EventMetaProps) {
  const cat = categories.find((c) => c.id === event.category);
  const isCanceled = event.status === "canceled";
  const live = !isCanceled && isLiveNow(event);
  const free = isFreeEntry(event.entryInfo);
  const donation = !free && isDonationEntry(event.entryInfo);

  const text = size === "md" ? "text-[11px]" : "text-[10px]";

  return (
    <div
      className={`flex items-center gap-2 flex-wrap font-mono ${text} font-bold uppercase tracking-[0.08em]`}
    >
      {/* Time slot — pulsing "Now" when live, otherwise the start time. */}
      {event.startTime && (
        <>
          {live ? (
            <span className="inline-flex items-center gap-1.5 text-accent">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-ib-pulse" />
              Now
            </span>
          ) : (
            <span>{event.startTime}</span>
          )}
          <span className="text-muted-foreground">·</span>
        </>
      )}

      <span style={cat?.color ? { color: cat.color } : { color: "var(--accent)" }}>
        {cat?.label ?? event.category}
      </span>

      {/* Entry pills (Free / Donation) stay at a fixed 10px regardless of
          the meta row's size prop, so the small grid cards (Tonight's
          Highlights) and the wide free cards (FreeTonightStrip) show
          identical pill chrome. Only time + category scale with `size`. */}
      {free && (
        <span className="ml-1 px-1.5 py-0.5 border border-current text-muted-foreground tracking-[0.1em] text-[10px]">
          Free
        </span>
      )}
      {donation && (
        <span className="ml-1 px-1.5 py-0.5 border border-current text-muted-foreground tracking-[0.1em] text-[10px]">
          Donation
        </span>
      )}
      {event.isCommunitySubmission && (
        <span className="ml-1 px-1.5 py-0.5 border border-current text-muted-foreground tracking-[0.1em] text-[10px]">
          Community submission
        </span>
      )}
      {isCanceled && (
        <span className="ml-1 px-1.5 py-0.5 border tracking-[0.1em]" style={{ borderColor: "#b91c1c", color: "#b91c1c" }}>
          Canceled
        </span>
      )}
      {walkingMin !== undefined && (
        <>
          <span className="text-muted-foreground">·</span>
        {/* Walking-distance chip — uses the same Tabler "walk" SVG and
            accent color as the map popup chip so the signal is identical
            across the index and the map. Sits inline at the end of the
            meta row (next to category / Free / Canceled), not pushed
            flush right — keeps the row's left-anchored reading order. */}
        <span className="inline-flex items-center gap-1 text-accent">
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 4a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
            <path d="M7 21l3 -4" />
            <path d="M16 21l-2 -4l-3 -3l1 -6" />
            <path d="M6 12l2 -3l4 -1l3 3l3 1" />
          </svg>
          {walkingMin} min
        </span>
        </>
      )}
    </div>
  );
}
