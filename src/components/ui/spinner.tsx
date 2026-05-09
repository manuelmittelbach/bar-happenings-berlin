import { SlowConnectionHint } from "@/components/ui/slow-connection-hint";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  /**
   * Show "Slow connection — still loading…" below the spinner after a delay.
   * Defaults to true for md/lg (page-level spinners) and false for sm
   * (inline button spinners), where stacked text would break layout.
   */
  slowHint?: boolean;
  slowHintDelayMs?: number;
}

const sizeClass: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function Spinner({
  size = "md",
  className = "",
  slowHint,
  slowHintDelayMs = 5000,
}: SpinnerProps) {
  const showHint = slowHint ?? size !== "sm";

  const ring = (
    <div
      role="status"
      aria-label="Loading"
      className={`${sizeClass[size]} border-2 border-foreground border-t-transparent rounded-full animate-spin ${className}`}
    />
  );

  if (!showHint) return ring;

  return (
    <div className="flex flex-col items-center gap-3">
      {ring}
      <SlowConnectionHint delayMs={slowHintDelayMs} />
    </div>
  );
}
