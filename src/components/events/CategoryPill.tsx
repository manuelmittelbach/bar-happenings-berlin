import { getCategoryInfoByLabel, type CategoryInfo } from "@/data/mockData";
import { Mic, Brain, Globe, Handshake, Heart, Headphones, Guitar, Sparkles, MicVocal, Wine, Film, Trophy, LayoutGrid } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface CategoryPillProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

const categoryIcons: Record<string, LucideIcon> = {
  "comedy": Mic,
  "pub-quiz": Brain,
  "language-exchange": Globe,
  "social": Handshake,
  "singles": Heart,
  "dj-music": Headphones,
  "live-music": Guitar,
  "other": Sparkles,
  "open-mic": MicVocal,
  "quiz-night": Brain,
  "promo-date-night": Wine,
  "screening": Film,
  "sport": Trophy,
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

/* Short labels for desktop scanning */
const desktopShortLabels: Record<string, string> = {
  "Social / Networking": "Social",
  "Language Exchange": "Language",
  "DJ / Music Night": "DJ",
  "Singles & Dating": "Dating",
  "Promo / Date Night": "Promo",
  "Sport / Games": "Sport",
  "Quiz Night": "Quiz",
  "Live Music": "Live",
  "Open Mic": "Open Mic",
};

/* Priority order for desktop — most popular first */
const desktopCategoryOrder: string[] = [
  "Comedy", "Pub Quiz", "Live Music", "DJ / Music Night",
  "Social / Networking", "Language Exchange", "Singles & Dating",
  "Open Mic", "Quiz Night", "Promo / Date Night", "Screening",
  "Sport / Games", "Other",
];

/* ── Desktop icon-based category row ── */
export function CategoryIconRow({
  categories,
  activeCategory,
  onSelect,
}: {
  categories: string[];
  activeCategory: string;
  onSelect: (cat: string) => void;
}) {
  // Sort categories by priority order
  const sorted = [...categories].sort((a, b) => {
    const ai = desktopCategoryOrder.indexOf(a);
    const bi = desktopCategoryOrder.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  return (
    <div className="flex gap-0.5 overflow-x-auto scrollbar-hide">
      {/* All — reset button, visually separated */}
      <button
        onClick={() => onSelect("")}
        className={`shrink-0 flex items-center gap-2 px-4 py-2 mr-1 border-r-2 border-border transition-all ${
          !activeCategory
            ? "text-accent"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <div className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${
          !activeCategory
            ? "bg-accent text-background"
            : "bg-muted border-2 border-border"
        }`}>
          <LayoutGrid className="h-[18px] w-[18px]" />
        </div>
        <span className="text-[11px] font-mono font-bold uppercase tracking-wider">All</span>
      </button>

      {sorted.map((cat) => {
        const info = getCategoryInfoByLabel(cat);
        const Icon = info ? categoryIcons[info.id] : Sparkles;
        const I = Icon || Sparkles;
        const isActive = activeCategory === cat;
        const shortLabel = desktopShortLabels[cat] || cat;
        return (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className={`group shrink-0 flex flex-col items-center gap-1 px-2.5 py-2 transition-all ${
              isActive ? "text-accent" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <div className={`w-11 h-11 flex items-center justify-center rounded-full transition-all duration-200 ${
              isActive
                ? "bg-accent text-background  scale-105"
                : "bg-muted border-2 border-border group-hover:border-foreground group-hover:scale-105"
            }`}>
              <I className="h-[22px] w-[22px]" />
            </div>
            <span className={`text-[10px] font-mono font-bold uppercase tracking-wider leading-tight text-center whitespace-nowrap transition-colors ${
              isActive ? "text-accent" : ""
            }`}>
              {shortLabel}
            </span>
          </button>
        );
      })}
    </div>
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
  // Same sort order as desktop
  const sorted = [...categories].sort((a, b) => {
    const ai = desktopCategoryOrder.indexOf(a);
    const bi = desktopCategoryOrder.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  return (
    <div className="flex gap-2 overflow-x-auto -mx-4 px-4 scrollbar-hide">
      {/* All */}
      <button
        onClick={() => onSelect("")}
        className={`shrink-0 flex flex-col items-center gap-1.5 px-1 py-1 transition-colors ${
          !activeCategory ? "text-accent" : "text-muted-foreground"
        }`}
      >
        <div className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-200 ${
          !activeCategory
            ? "bg-accent text-background "
            : "bg-muted border-2 border-border"
        }`}>
          <LayoutGrid className="h-5 w-5" />
        </div>
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider">All</span>
      </button>

      {sorted.map((cat) => {
        const info = getCategoryInfoByLabel(cat);
        const Icon = info ? categoryIcons[info.id] : Sparkles;
        const I = Icon || Sparkles;
        const isActive = activeCategory === cat;
        const shortLabel = desktopShortLabels[cat] || cat;
        return (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className={`shrink-0 flex flex-col items-center gap-1.5 px-1 py-1 transition-colors ${
              isActive ? "text-accent" : "text-muted-foreground"
            }`}
          >
            <div className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-200 ${
              isActive
                ? "bg-accent text-background  scale-105"
                : "bg-muted border-2 border-border"
            }`}>
              <I className="h-5 w-5" />
            </div>
            <span className={`text-[10px] font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
              isActive ? "text-accent" : ""
            }`}>
              {shortLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
