interface CategoryPillProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export default function CategoryPill({ label, active, onClick }: CategoryPillProps) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center px-3 py-1.5 font-mono text-xs uppercase tracking-wider border-2 transition-all duration-200 ${
        active
          ? "border-tiger-gold bg-tiger-gold text-primary-foreground"
          : "border-border bg-transparent text-muted-foreground hover:border-tiger-gold hover:text-tiger-gold"
      }`}
    >
      {label}
    </button>
  );
}
