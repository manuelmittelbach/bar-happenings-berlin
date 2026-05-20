import { berlinDateStringOffset } from "@/lib/dateFormat";

export type DayTab = "tonight" | "tomorrow" | "upcoming";

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

// "13 May" — day + month only, used for the Upcoming range subline (desktop).
const formatDayMonth = (offset: number): string => {
  const iso = berlinDateStringOffset(offset);
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

// "13–25 May" / "29 May–4 Jun" — compact range used on mobile so the
// Later subline fits inside the third tab without horizontal overflow.
const formatRangeCompact = (startOffset: number, endOffset: number): string => {
  const startIso = berlinDateStringOffset(startOffset);
  const endIso = berlinDateStringOffset(endOffset);
  const startD = new Date(startIso + "T00:00:00");
  const endD = new Date(endIso + "T00:00:00");
  const startMonth = startD.toLocaleDateString("en-GB", { month: "short" });
  const endMonth = endD.toLocaleDateString("en-GB", { month: "short" });
  const startDay = startD.getDate();
  const endDay = endD.getDate();
  return startMonth === endMonth
    ? `${startDay}–${endDay} ${endMonth}`
    : `${startDay} ${startMonth}–${endDay} ${endMonth}`;
};

/* DaySwitcher — Tonight · Tomorrow · Upcoming tabs sitting just above the
 * homepage section list. Active tab gets an accent underline; inactive
 * tabs read at 55% opacity so the eye lands on the current view first.
 *
 * Tonight/Tomorrow show the matching weekday + date. "Upcoming" shows the
 * concrete window it covers: day after tomorrow → cutoffDate in
 * Index.tsx (currently offset +2 → +14, i.e. the next ~12 days). Tabs
 * are recomputed each render so the dates stay correct if the page
 * stays open across midnight.
 */
export default function DaySwitcher({ active, onChange }: DaySwitcherProps) {
  const tabs: { id: DayTab; label: string; sub: string; subMobile: string }[] = [
    {
      id: "tonight",
      label: "Tonight",
      sub: formatWithWeekday(0),
      subMobile: formatWithWeekday(0),
    },
    {
      id: "tomorrow",
      label: "Tomorrow",
      sub: formatWithWeekday(1),
      subMobile: formatWithWeekday(1),
    },
    {
      id: "upcoming",
      label: "Upcoming",
      sub: `${formatDayMonth(2)} – ${formatDayMonth(13)}`,
      subMobile: formatRangeCompact(2, 13),
    },
  ];

  return (
    <div
      role="tablist"
      aria-label="Day"
      className="flex gap-0 mt-5"
    >
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className="flex-1 min-w-0 text-center md:text-left px-3 md:px-6 pt-3.5 pb-4 bg-transparent font-serif transition-colors"
          >
            <div
              className={`font-serif font-bold leading-[1.05] text-[18px] md:text-[22px] ${
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
                {t.label}
              </span>
            </div>
            <div
              className="font-mono font-normal uppercase text-muted-foreground mt-1 truncate"
              style={{ fontSize: 10, letterSpacing: "0.12em" }}
            >
              <span className="md:hidden">{t.subMobile}</span>
              <span className="hidden md:inline">{t.sub}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
