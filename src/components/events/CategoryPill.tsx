import { useCategories } from "@/hooks/useEvents";
import { Mic, Brain, Globe, Handshake, Heart, Headphones, Guitar, Sparkles, MicVocal, Film, Trophy, LayoutGrid, Crown, Dice5, Laugh } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface CategoryPillProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

const categoryIcons: Record<string, LucideIcon> = {
  "comedy": Laugh,
  "pub-quiz": Brain,
  "live-music": Guitar,
  "dj-music": Headphones,
  "open-mic": MicVocal,
  "karaoke": Mic,
  "drag-cabaret": Crown,
  "social": Handshake,
  "language-exchange": Globe,
  "singles": Heart,
  "games": Dice5,
  "sports": Trophy,
  "screening": Film,
  "other": Sparkles,
};

export default function CategoryPill({ label, active, onClick }: CategoryPillProps) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center px-3 py-1.5 font-mono text-xs uppercase tracking-wider border-2 transition-all duration-200 ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-transparent text-muted-foreground hover:border-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

/* Short labels for desktop scanning (only categories whose full label is too long for a pill).
   Keys are category slug-IDs (categories.id), values are the rendered short text. */
const desktopShortLabels: Record<string, string> = {
  "live-music": "Live",
  // Inactive entries kept here so re-enabling a category needs no extra wiring:
  "social": "Social",
  "language-exchange": "Language",
};

/* Priority order — controls filter-bar order on desktop and mobile.
   Values are category slug-IDs (categories.id). */
const desktopCategoryOrder: string[] = [
  "live-music", "comedy", "dj-music", "open-mic", "pub-quiz",
  "karaoke", "drag-cabaret", "screening", "other",
  // Inactive (kept for fast re-enable):
  "singles", "social", "language-exchange", "games", "sports",
];

/* ── Desktop icon-based category row ──
   Larger and more breathable than the mobile bar — desktop has the
   real estate for an editorial-feeling category strip, so we lean into
   it: bigger circles, bigger icons, readable labels. Same shape system
   as mobile so brand consistency stays intact. */
export function CategoryIconRow({
  categories,
  activeCategory,
  onSelect,
}: {
  categories: string[];
  activeCategory: string;
  onSelect: (cat: string) => void;
}) {
  const { data: catData = [] } = useCategories();

  // Sort categories by priority order
  const sorted = [...categories].sort((a, b) => {
    const ai = desktopCategoryOrder.indexOf(a);
    const bi = desktopCategoryOrder.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide">
      {/* All — reset button, visually separated */}
      <button
        onClick={() => onSelect("")}
        className={`shrink-0 flex items-center gap-3 px-4 py-2 mr-2 border-r-2 border-border transition-all ${
          !activeCategory
            ? "text-accent"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <div className={`w-14 h-14 flex items-center justify-center rounded-full transition-all ${
          !activeCategory
            ? "bg-accent text-background"
            : "bg-background border-2 border-border"
        }`}>
          <LayoutGrid className="h-6 w-6" />
        </div>
        <span className="text-xs font-mono font-normal uppercase tracking-wider">All</span>
      </button>

      {sorted.map((cat) => {
        const info = catData.find((c) => c.id === cat);
        const Icon = info ? categoryIcons[info.id] : undefined;
        const isActive = activeCategory === cat;
        const shortLabel = desktopShortLabels[cat] || info?.label || cat;
        const activeColor = info?.color;
        return (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            style={isActive && activeColor ? { color: activeColor } : undefined}
            className={`group shrink-0 flex flex-col items-center gap-1.5 px-3 py-2 transition-all ${
              isActive ? "" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <div
              style={isActive && activeColor ? { backgroundColor: activeColor } : undefined}
              className={`w-14 h-14 flex items-center justify-center rounded-full transition-all duration-200 ${
                isActive
                  ? "text-background scale-105 shadow-md"
                  : "bg-background border-2 border-border group-hover:border-foreground group-hover:scale-105"
              }`}
            >
              {Icon ? <Icon className="h-7 w-7" /> : <span className="text-[26px] leading-none">{info?.emoji ?? "✦"}</span>}
            </div>
            <span className="text-xs font-mono font-normal uppercase tracking-wider leading-tight text-center whitespace-nowrap transition-colors">
              {shortLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Desktop rectangle-pill category row ──
   Lifted verbatim from the Claude Design `CategoryBar.jsx` prototype:
   2px outlined rectangle pills with icon + label, mono caps 11px /
   0.08em tracking. Active pill inverts to filled foreground. Inactive
   icons take the category color so the strip reads as a colored index.
   Desktop only — mobile keeps the round disks (CategoryIconBar) since
   the rectangles wouldn't scroll as compactly on narrow screens. */
export function CategoryRowPills({
  categories,
  activeCategory,
  onSelect,
}: {
  categories: string[];
  activeCategory: string;
  onSelect: (cat: string) => void;
}) {
  const { data: catData = [] } = useCategories();

  const sorted = [...categories].sort((a, b) => {
    const ai = desktopCategoryOrder.indexOf(a);
    const bi = desktopCategoryOrder.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  return (
    /* Same right-edge fade pattern as CategoryIconBar — wrapper is
       `relative` so the gradient overlay can sit on top of the
       scroll row, hinting at off-screen pills on narrower desktops. */
    <div className="relative">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        <Pill
          label="All"
          Icon={LayoutGrid}
          color="#ED5B1C"
          active={!activeCategory}
          onClick={() => onSelect("")}
        />
        {sorted.map((cat) => {
          const info = catData.find((c) => c.id === cat);
          const Icon = categoryIcons[cat];
          const isActive = activeCategory === cat;
          return (
            <Pill
              key={cat}
              label={info?.label ?? cat}
              Icon={Icon}
              color={info?.color}
              active={isActive}
              onClick={() => onSelect(cat)}
            />
          );
        })}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent"
      />
    </div>
  );
}

function Pill({
  label,
  Icon,
  color,
  active,
  onClick,
}: {
  label: string;
  Icon?: LucideIcon;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 whitespace-nowrap border-2 font-mono text-[11px] font-normal uppercase tracking-[0.08em] transition-colors ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-foreground hover:border-foreground"
      }`}
    >
      {Icon && (
        <Icon
          className="h-3.5 w-3.5"
          /* Category icons keep their hue in both states — on inactive
             pills as a colored peg, on active pills as a colored signal
             against the black fill. Only the All pill (no `color`) falls
             back to inheriting the pill's text color. */
          style={color ? { color } : undefined}
        />
      )}
      {label}
    </button>
  );
}

/* ── Mobile icon-based category scroller ── */
export function CategoryIconBar({
  categories,
  activeCategory,
  onSelect,
}: {
  categories: string[];
  activeCategory: string;
  onSelect: (cat: string) => void;
}) {
  const { data: catData = [] } = useCategories();

  // Same sort order as desktop
  const sorted = [...categories].sort((a, b) => {
    const ai = desktopCategoryOrder.indexOf(a);
    const bi = desktopCategoryOrder.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  /* Disk treatment — editorial restraint: the disk itself stays neutral
     (cream paper / muted border, same as before), only the ICON carries
     the category hue. That makes the row read as a color-key at a glance
     without any glow or chrome that would push the chip into "arcade"
     territory. ACTIVE: the disk fills with the category color, the icon
     drops to background, and a precise 2px scale-up provides the
     selection signal — no glow, no halo. Hex+alpha (#RRGGBBAA) is
     supported in every browser the app targets, including WKWebView. */
  const activeDiskStyle = (color: string): React.CSSProperties => ({
    backgroundColor: color,
    borderColor: color,
    color: "hsl(var(--background))",
  });

  return (
    /* Wrapper is `relative` so the right-edge gradient overlay (a sibling
       div positioned absolutely) can sit on top of the scrollable row.
       The overlay fades the rightmost item out — a scroll-discoverability
       hint so users on mobile realize "more categories are off-screen". */
    <div className="relative -mx-4">
      <div className="flex gap-2 overflow-x-auto px-4 scrollbar-hide">
        {/* All — brand accent (#ED5B1C) carries the icon in both states,
            same disk grammar as the category chips below. */}
        <button
          onClick={() => onSelect("")}
          className={`shrink-0 flex flex-col items-center gap-1.5 px-1 py-1 transition-colors ${
            !activeCategory ? "text-accent" : "text-muted-foreground"
          }`}
        >
          <div
            style={!activeCategory ? activeDiskStyle("#ED5B1C") : undefined}
            className={`w-12 h-12 flex items-center justify-center rounded-full border-2 transition-all duration-200 ${
              !activeCategory ? "scale-105" : "bg-muted border-border"
            }`}
          >
            <LayoutGrid className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-mono font-normal uppercase tracking-wider">All</span>
        </button>

      {sorted.map((cat) => {
        const info = catData.find((c) => c.id === cat);
        const Icon = info ? categoryIcons[info.id] : undefined;
        const isActive = activeCategory === cat;
        const shortLabel = desktopShortLabels[cat] || info?.label || cat;
        const catColor = info?.color ?? "#6b7280";
        return (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            style={isActive ? { color: catColor } : undefined}
            className={`shrink-0 flex flex-col items-center gap-1.5 px-1 py-1 transition-colors ${
              isActive ? "" : "text-muted-foreground"
            }`}
          >
            <div
              style={isActive ? activeDiskStyle(catColor) : undefined}
              className={`w-12 h-12 flex items-center justify-center rounded-full border-2 transition-all duration-200 ${
                isActive ? "scale-105" : "bg-muted border-border"
              }`}
            >
              {Icon ? <Icon className="h-5 w-5" /> : <span className="text-xl leading-none">{info?.emoji ?? "✦"}</span>}
            </div>
            <span className="text-[10px] font-mono font-normal uppercase tracking-wider whitespace-nowrap transition-colors">
              {shortLabel}
            </span>
          </button>
        );
      })}
      </div>

      {/* Right-edge fade — visual hint that the row scrolls horizontally.
          pointer-events-none so it never blocks taps on the underlying
          icon buttons. `from-background` matches the page bg so the fade
          reads as the page reaching in, not a separate UI element. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent"
      />
    </div>
  );
}
