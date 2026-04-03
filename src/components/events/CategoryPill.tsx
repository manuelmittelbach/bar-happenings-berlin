import { cn } from "@/lib/utils";

interface CategoryPillProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export default function CategoryPill({ label, active, onClick }: CategoryPillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center px-4 py-2 text-sm font-medium rounded-sm border transition-all whitespace-nowrap",
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-transparent text-foreground border-border hover:bg-muted"
      )}
    >
      {label}
    </button>
  );
}
