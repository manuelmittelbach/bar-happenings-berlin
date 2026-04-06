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
  return (
    <div className="flex gap-1 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
      {/* All */}
      <button
        onClick={() => onSelect("")}
        className={`flex flex-col items-center gap-1.5 min-w-[60px] px-2 py-2 transition-colors ${
          !activeCategory ? "text-accent" : "text-muted-foreground"
        }`}
      >
        <div className={`w-12 h-12 flex items-center justify-center rounded-full border-2 transition-all ${
          !activeCategory
            ? "border-accent bg-accent/15"
            : "border-border bg-muted hover:border-foreground"
        }`}>
          <LayoutGrid className="h-5 w-5" />
        </div>
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider">All</span>
      </button>

      {categories.map((cat) => {
        const info = getCategoryInfoByLabel(cat);
        const Icon = info ? categoryIcons[info.id] : Sparkles;
        const isActive = activeCategory === cat;
        const shortLabel = info?.id === "language-exchange" ? "Lang." : 
               info?.id === "social" ? "Social" :
               info?.id === "dj-music" ? "DJ" :
               info?.id === "promo-date-night" ? "Promo" :
               info?.id === "sport" ? "Sport" :
               cat.length > 8 ? cat.slice(0, 7) + "." : cat;
        return (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className={`flex flex-col items-center gap-1.5 min-w-[60px] px-2 py-2 transition-colors ${
              isActive ? "text-accent" : "text-muted-foreground"
            }`}
          >
            <div className={`w-10 h-10 flex items-center justify-center rounded-full border-2 transition-all ${
              isActive
                ? "border-accent bg-accent/15"
                : "border-border bg-muted hover:border-foreground"
            }`}>
              {(() => { const I = Icon || Sparkles; return <I className="h-4.5 w-4.5" />; })()}
            </div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider leading-tight text-center max-w-[64px] truncate">
              {shortLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
