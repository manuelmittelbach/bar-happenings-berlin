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

interface DayChip {
  iso: string;
  // "Tonight" / "Tomorrow" / weekday short ("Thu").
  label: string;
  // Date subline for the desktop tabs ("Tue 5 Aug" / "7 Aug").
  sub: string;
  // Compact single-line label for the mobile pills ("Tonight" / "Thu 7").
  labelMobile: string;
  value: string;
}

/* DayStrip — the 7-day filter shared by Index and MapPage: Tonight,
 * Tomorrow, then 5 weekday entries. Every entry means exactly ONE day; the
 * old "Upcoming" bucket is gone. Two deliberately different renderings,
 * matching the pre-strip chrome: mobile gets the rounded-full mono pills
 * (now horizontally scrollable), desktop gets the editorial serif tabs with
 * the accent underline and date sublines. Chips are recomputed each render
 * so the dates stay correct if the page stays open across midnight.
 */
export default function DayStrip({ activeIso, onChange }: DayStripProps) {
  const chips: DayChip[] = Array.from({ length: VISIBLE_HORIZON + 1 }, (_, offset) => {
    const iso = berlinDateStringOffset(offset);
    const d = new Date(iso + "T00:00:00");
    const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
    const dayMonth = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    if (offset === 0 || offset === 1) {
      return {
        iso,
        label: offset === 0 ? "Tonight" : "Tomorrow",
        sub: `${weekday} ${dayMonth}`,
        labelMobile: offset === 0 ? "Tonight" : "Tomorrow",
        value: offset === 0 ? "Tonight" : "Tomorrow",
      };
    }
    return {
      iso,
      label: weekday,
      sub: dayMonth,
      labelMobile: `${weekday} ${d.getDate()}`,
      value: iso,
    };
  });

  return (
    <>
      {/* Mobile — rounded-full mono pills, horizontally scrollable now
          that there are seven of them. */}
      <div
        role="tablist"
        aria-label="Day"
        className="md:hidden flex items-center gap-2 py-2.5 overflow-x-auto scrollbar-hide"
      >
        {chips.map((c) => {
          const isActive = c.iso === activeIso;
          return (
            <button
              key={c.iso}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(c.value)}
              className={`shrink-0 inline-flex items-center justify-center px-4 py-2 rounded-full font-mono text-[10px] uppercase tracking-wider border-2 transition-all ${
                isActive
                  ? "border-foreground bg-foreground text-background"
                  : "border-foreground hover:bg-foreground hover:text-background"
              }`}
            >
              {c.labelMobile}
            </button>
          );
        })}
      </div>

      {/* Desktop — editorial serif tabs with the accent underline, exactly
          the DaySwitcher look. Every tab sits at its fixed natural width
          (no flex-grow: growing from a 0% basis would visually shrink the
          tabs again as the window narrows — grow-redistribution, which
          shrink-0 can't prevent). When the window gets too narrow for all
          seven, the row scrolls horizontally instead. */}
      <div
        role="tablist"
        aria-label="Day"
        className="hidden md:flex gap-0 mt-5 overflow-x-auto scrollbar-hide"
      >
        {chips.map((c) => {
          const isActive = c.iso === activeIso;
          return (
            <button
              key={c.iso}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(c.value)}
              className="shrink-0 text-left px-4 pt-3.5 pb-4 bg-transparent font-serif transition-colors"
            >
              <div
                className={`font-serif font-bold leading-[1.05] text-[22px] ${
                  isActive ? "opacity-100" : "opacity-55"
                }`}
              >
                {/* Inline-block so the 2px accent underline hugs the label
                    width instead of stretching across the whole tab.
                    `pb-0.5` keeps a 2px gap between text descender and the
                    rule so it reads as a deliberate marker, not a typo
                    underline. Transparent border on inactive tabs holds
                    layout height steady — the label doesn't shift when
                    switching tabs. */}
                <span
                  className={`inline-block pb-0.5 border-b-2 ${
                    isActive ? "border-accent" : "border-transparent"
                  }`}
                >
                  {c.label}
                </span>
              </div>
              <div
                className="font-mono font-normal uppercase text-muted-foreground mt-1 whitespace-nowrap"
                style={{ fontSize: 10, letterSpacing: "0.12em" }}
              >
                {c.sub}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
