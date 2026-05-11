import { berlinDateStringOffset } from "@/lib/dateFormat";

export type DayTab = "tonight" | "tomorrow" | "later";

interface DaySwitcherProps {
  active: DayTab;
  onChange: (tab: DayTab) => void;
}

// "Sun 11 May" — weekday + day + month, used for the Tonight/Tomorrow sublines.
const formatWithWeekday = (offset: number): string => {
  const iso = berlinDateStringOffset(offset);
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
};

// "13 May" — day + month only, used for the Later range subline.
const formatDayMonth = (offset: number): string => {
  const iso = berlinDateStringOffset(offset);
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

/* DaySwitcher — Tonight · Tomorrow · Later tabs sitting just above the
 * homepage section list. Active tab gets an accent underline; inactive
 * tabs read at 55% opacity so the eye lands on the current view first.
 *
 * Tonight/Tomorrow show the matching weekday + date. "Later" shows the
 * concrete window it covers: day after tomorrow → cutoffDate in
 * Index.tsx (currently offset +2 → +14, i.e. the next ~12 days). Tabs
 * are recomputed each render so the dates stay correct if the page
 * stays open across midnight.
 */
export default function DaySwitcher({ active, onChange }: DaySwitcherProps) {
  const tabs: { id: DayTab; label: string; sub: string }[] = [
    { id: "tonight",  label: "Tonight",  sub: formatWithWeekday(0) },
    { id: "tomorrow", label: "Tomorrow", sub: formatWithWeekday(1) },
    { id: "later",    label: "Later",    sub: `${formatDayMonth(2)} – ${formatDayMonth(14)}` },
  ];

  return (
    <div
      role="tablist"
      aria-label="Day"
      className="flex gap-0 border-b-2 border-border mt-5"
    >
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={`flex-none text-left px-5 md:px-6 pt-3.5 pb-4 -mb-[2px] bg-transparent font-heading transition-colors ${
              isActive ? "border-b-[3px] border-accent" : "border-b-[3px] border-transparent"
            }`}
          >
            <div
              className={`font-heading font-bold leading-[1.05] ${
                isActive ? "opacity-100" : "opacity-55"
              }`}
              style={{ fontSize: 22 }}
            >
              {t.label}
            </div>
            <div
              className="font-mono font-bold uppercase text-muted-foreground mt-1"
              style={{ fontSize: 10, letterSpacing: "0.12em" }}
            >
              {t.sub}
            </div>
          </button>
        );
      })}
    </div>
  );
}
