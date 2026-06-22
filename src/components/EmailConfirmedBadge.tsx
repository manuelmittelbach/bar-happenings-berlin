import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { consumeJustConfirmed, clearJustConfirmed } from "@/lib/justConfirmed";

/* One-shot "Email confirmed" badge shown on the page a freshly-confirmed
 * session lands on. Reads the just-confirmed flag once on mount and clears it
 * immediately, so it stays visible while you're on this page but won't reappear
 * once you navigate elsewhere and back. Renders nothing without a fresh
 * confirmation. */
export function EmailConfirmedBadge({ className = "" }: { className?: string }) {
  const [show] = useState(consumeJustConfirmed);

  useEffect(() => {
    if (show) clearJustConfirmed();
  }, [show]);

  if (!show) return null;

  return (
    <div
      className={`inline-flex items-center gap-2 border-2 border-foreground bg-green-500/10 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-green-700 ${className}`}
    >
      <CheckCircle2 className="h-4 w-4" /> Email confirmed
    </div>
  );
}
