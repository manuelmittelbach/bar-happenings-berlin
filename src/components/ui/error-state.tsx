import { Link } from "react-router-dom";

interface ErrorStateProps {
  /** Heading — short statement of what failed. */
  title?: string;
  /** Sub-copy under the heading. */
  message?: string;
  /** Retry handler — usually a React Query `refetch`. Button hidden when absent. */
  onRetry?: () => void;
  /** Disables the button + swaps the label to "Retrying…" while a refetch is in flight. */
  isRetrying?: boolean;
  /** Compact variant for use inside an existing page section (no full-height centering). */
  inline?: boolean;
  /** Adds a "Back to home" link under the button — for full-page detail errors. */
  homeLink?: boolean;
}

/* Shared "couldn't load — retry" surface. Distinguishes a genuine failure
 * (DB/network unreachable) from a real empty result, so pages stop rendering
 * misleading empty copy ("That's it for tonight." / "No bars in the directory
 * yet.") when the data simply never arrived. Mirrors the inline error UI
 * EventDetail already shipped, lifted out so every data surface can reuse it. */
export function ErrorState({
  title = "Couldn't load",
  message = "Check your connection and try again.",
  onRetry,
  isRetrying = false,
  inline = false,
  homeLink = false,
}: ErrorStateProps) {
  const body = (
    <>
      <h2 className="font-body text-2xl font-bold m-0">{title}</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="mt-4 px-5 py-2.5 border-2 border-foreground bg-background text-foreground font-mono font-bold text-sm uppercase tracking-wider hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
        >
          {isRetrying ? "Retrying…" : "Retry"}
        </button>
      )}
      {homeLink && (
        <Link to="/" className="text-sm text-accent mt-4 inline-block">
          Back to home
        </Link>
      )}
    </>
  );

  if (inline) {
    return (
      <div className="px-6 py-12 md:py-16 text-center" aria-live="polite">
        {body}
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center bg-background px-6 py-16 text-center"
      aria-live="polite"
    >
      {body}
    </div>
  );
}
