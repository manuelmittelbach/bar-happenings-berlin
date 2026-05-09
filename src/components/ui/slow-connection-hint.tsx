import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface SlowConnectionHintProps {
  delayMs?: number;
  className?: string;
}

export function SlowConnectionHint({
  delayMs = 5000,
  className = "",
}: SlowConnectionHintProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs]);

  if (!visible) return null;

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "text-xs text-muted-foreground font-mono uppercase tracking-wider",
        className,
      )}
    >
      Slow connection — still loading…
    </p>
  );
}
