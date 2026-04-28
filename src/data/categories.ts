export interface CategoryInfo {
  id: string;
  label: string;
  emoji: string;
  color: string;
  // Toggle to true to bring a category back into the filter bar.
  enabled: boolean;
}

export const categoryInfos: CategoryInfo[] = [
  // ── Active categories (shown in filter bar, in this order) ──
  { id: "comedy",       label: "Comedy",     emoji: "🎤",  color: "#d63c2f", enabled: true },
  { id: "pub-quiz",     label: "Quiz",       emoji: "🧠",  color: "#2456f5", enabled: true },
  { id: "live-music",   label: "Live Music", emoji: "🎸",  color: "#f07d30", enabled: true },
  { id: "dj-music",     label: "DJ",         emoji: "🎧",  color: "#9b5cf6", enabled: true },
  { id: "karaoke",      label: "Karaoke",    emoji: "🎤",  color: "#d946ef", enabled: true },
  { id: "open-mic",     label: "Open Mic",   emoji: "🎙️", color: "#e88a2e", enabled: true },
  { id: "drag-cabaret", label: "Drag",       emoji: "👑",  color: "#f59e0b", enabled: true },
  { id: "screening",    label: "Screening",  emoji: "🎬",  color: "#6366f1", enabled: true },
  { id: "singles",      label: "Dating",     emoji: "💘",  color: "#ec4899", enabled: true },
  { id: "other",        label: "Other",      emoji: "✦",   color: "#14b8a6", enabled: true },

  // ── Inactive (icons, images and DB records still wired up — flip enabled to re-add) ──
  { id: "social",            label: "Social / Networking", emoji: "🤝",  color: "#e8d84b", enabled: false },
  { id: "language-exchange", label: "Language Exchange",   emoji: "🌍",  color: "#3abf6e", enabled: false },
  { id: "games",             label: "Games",               emoji: "🎲",  color: "#65a30d", enabled: false },
  { id: "sports",            label: "Sports",              emoji: "⚽",  color: "#16a34a", enabled: false },
];

export const categories = categoryInfos.filter(c => c.enabled).map(c => c.label);

export const getCategoryInfo = (categoryId: string) =>
  categoryInfos.find(c => c.id === categoryId);

export const getCategoryInfoByLabel = (label: string) =>
  categoryInfos.find(c => c.label === label);
