export interface CategoryInfo {
  id: string;
  label: string;
  emoji: string;
  color: string;
}

export const categoryInfos: CategoryInfo[] = [
  { id: "comedy", label: "Comedy", emoji: "🎤", color: "#d63c2f" },
  { id: "pub-quiz", label: "Pub Quiz", emoji: "🧠", color: "#2456f5" },
  { id: "language-exchange", label: "Language Exchange", emoji: "🌍", color: "#3abf6e" },
  { id: "social", label: "Social / Networking", emoji: "🤝", color: "#e8d84b" },
  { id: "singles", label: "Singles & Dating", emoji: "💘", color: "#ec4899" },
  { id: "dj-music", label: "DJ / Music Night", emoji: "🎧", color: "#9b5cf6" },
  { id: "live-music", label: "Live Music", emoji: "🎸", color: "#f07d30" },
  { id: "other", label: "Other", emoji: "✦", color: "#14b8a6" },
  { id: "open-mic", label: "Open Mic", emoji: "🎙️", color: "#e88a2e" },
  { id: "quiz-night", label: "Quiz Night", emoji: "🧠", color: "#2456f5" },
  { id: "promo-date-night", label: "Promo / Date Night", emoji: "🍸", color: "#ec4899" },
  { id: "screening", label: "Screening", emoji: "🎬", color: "#6366f1" },
  { id: "sport", label: "Sport / Games", emoji: "🏆", color: "#22c55e" },
];

export const categories = categoryInfos.map(c => c.label);

export const getCategoryInfo = (categoryId: string) =>
  categoryInfos.find(c => c.id === categoryId);

export const getCategoryInfoByLabel = (label: string) =>
  categoryInfos.find(c => c.label === label);
