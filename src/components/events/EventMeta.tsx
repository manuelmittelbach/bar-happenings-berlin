import { isLiveNow } from "@/lib/eventStatus";
import { isFreeEntry, isDonationEntry } from "@/lib/entryInfo";
import type { BarlinEvent } from "@/types/event";
import type { CategoryRow } from "@/lib/supabaseQueries";

interface EventMetaProps {
  event: BarlinEvent;
  categories: CategoryRow[];
  // Slightly larger mono in the wide "free" variant
  size?: "sm" | "md";
}

/* EventMeta — the time · category · FREE/DONATION/Canceled row shared by
 * every card variant in the design. Strict translation of `EventCard.jsx`
 * meta block: 10–11px mono uppercase tracked 0.08em, with the time slot
 * replaced by a pulsing orange "Now" when the event is currently live.
 *
 * Temporal "Soon / Over / Might be over" badges were removed per the
 * design — only the Now indicator and the static category/price pills
 * remain. */
export default function EventMeta({ event, categories, size = "sm" }: EventMetaProps) {
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

      {free && (
        <span className="ml-1 px-1.5 py-0.5 border border-current text-muted-foreground tracking-[0.1em]">
          Free
        </span>
      )}
      {donation && (
        <span className="ml-1 px-1.5 py-0.5 border border-current text-muted-foreground tracking-[0.1em]">
          Donation
        </span>
      )}
      {isCanceled && (
        <span className="ml-1 px-1.5 py-0.5 border tracking-[0.1em]" style={{ borderColor: "#b91c1c", color: "#b91c1c" }}>
          Canceled
        </span>
      )}
    </div>
  );
}
