import { berlinDateStringOffset } from "@/lib/dateFormat";
import { VISIBLE_HORIZON } from "@/lib/eventListing";

interface DayStripProps {
  // Resolved ISO date of the selected day — compute it with
  // resolveActiveDay(activeDate) so stale stored values highlight Tonight.
  activeIso: string;
  // Emits the value to store in the day filter: "Tonight", "Tomorrow", or a
  // concrete "YYYY-MM-DD" for the weekday chips. The named values stay
  // relative so a session crossing midnight keeps meaning "today"; concrete
  // days are absolute.
  onChange: (value: string) => void;
}

/* DayStrip — the 7-day strip shared by Index and MapPage: one sharp chip
 * per selectable day (Tonight, Tomorrow, then 5 weekdays). Every chip means
 * exactly ONE day; the old "Upcoming" bucket is gone. Horizontally
 * scrollable on mobile, fits in one row on desktop. Chips are recomputed
 * each render so the dates stay correct if the page stays open across
 * midnight.
 */
export default function DayStrip({ activeIso, onChange }: DayStripProps) {
  const chips = Array.from({ length: VISIBLE_HORIZON + 1 }, (_, offset) => {
    const iso = berlinDateStringOffset(offset);
    const d = new Date(iso + "T00:00:00");
    const label =
      offset === 0 ? "Tonight"
      : offset === 1 ? "Tomorrow"
      : d.toLocaleDateString("en-GB", { weekday: "short" });
    const sub = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const value = offset === 0 ? "Tonight" : offset === 1 ? "Tomorrow" : iso;
    return { iso, label, sub, value };
  });

  return (
    <div
      role="tablist"
      aria-label="Day"
      className="flex gap-2 py-2.5 md:py-3 overflow-x-auto scrollbar-hide"
    >
      {chips.map((c) => {
        const isActive = c.iso === activeIso;
        // flex-1 with basis-0 → all chips share the row equally on desktop;
        // on narrow screens they bottom out at their min-content width and
        // the strip scrolls instead.
        return (
          <button
            key={c.iso}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(c.value)}
            className={`flex-1 basis-0 flex flex-col items-center justify-center px-3.5 md:px-4 py-1.5 md:py-2 border-2 border-foreground font-mono uppercase transition-all ${
              isActive
                ? "bg-foreground text-background"
                : "hover:bg-foreground hover:text-background"
            }`}
          >
            <span className="text-[10px] md:text-[11px] tracking-wider font-bold leading-tight">
              {c.label}
            </span>
            {/* Opacity (not text-muted-foreground) so the subline inverts
                along with the chip on active/hover. */}
            <span className="text-[9px] tracking-wide opacity-60 leading-tight mt-0.5">
              {c.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}
