import { Spinner } from "@/components/ui/spinner";
import { useDelayedShow } from "@/hooks/useDelayedShow";

interface PageSpinnerProps {
  /**
   * Render as an in-page section (smaller padding, no full-bleed background)
   * instead of a full-page loader. Use for partial states inside a page that's
   * already rendering.
   */
  inline?: boolean;
  /** Delay before the spinner appears, in ms. Sub-100ms loads stay invisible. */
  delayMs?: number;
}

export function PageSpinner({ inline = false, delayMs = 100 }: PageSpinnerProps = {}) {
  const show = useDelayedShow(delayMs);
  if (!show) return null;
  return (
    <div
      className={
        inline
          ? "flex items-center justify-center py-16"
          : "flex flex-1 items-center justify-center bg-background py-24"
      }
      aria-busy="true"
      aria-live="polite"
    >
      <Spinner size="lg" />
    </div>
  );
}
