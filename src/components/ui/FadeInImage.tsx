import { ReactNode, useState } from "react";

/**
 * Image that fades in once it has decoded, with built-in failure recovery.
 *
 * The reveal is gated on a successful load: the <img> sits at opacity-0 behind
 * a pulsing skeleton until either `onLoad` fires or the `ref` callback catches
 * an already-cached (complete) image. The crucial addition over a plain
 * fade-in is `onError` — without it, a single failed request (network blip,
 * a 5xx from the CDN, a burst-throttled connection) leaves the image stuck at
 * opacity-0 forever, showing nothing but the grey skeleton. Here a failure
 * triggers ONE automatic retry (with a cache-buster so the browser refetches
 * instead of replaying the broken response); if that also fails we render the
 * `fallback` instead of hanging.
 */
interface FadeInImageProps {
  src: string;
  alt: string;
  objectPosition?: string;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  /** Classes for the <img>. The opacity-0/100 toggle is appended by the component. */
  className?: string;
  /** Classes for the loading skeleton shown until the image decodes. */
  skeletonClassName?: string;
  /** Rendered instead of the image once both load attempts have failed. */
  fallback?: ReactNode;
}

export default function FadeInImage({
  src,
  alt,
  objectPosition,
  loading = "eager",
  fetchPriority = "auto",
  className = "absolute inset-0 w-full h-full object-cover transition-opacity duration-500",
  skeletonClassName = "absolute inset-0 bg-muted animate-pulse",
  fallback = null,
}: FadeInImageProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  // 0 = first try with the real URL; 1 = one retry with a cache-buster.
  const [attempt, setAttempt] = useState(0);

  if (status === "error") return <>{fallback}</>;

  // The cache-buster forces a genuine refetch on retry: replaying the same URL
  // could just re-serve the failed/poisoned cache entry and fail identically.
  const retrySrc =
    attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}retry=${attempt}`;

  return (
    <>
      {status === "loading" && (
        <div className={skeletonClassName} aria-hidden="true" />
      )}
      <img
        // Remount on retry so the new (cache-busted) src is actually fetched
        // rather than React diffing it onto the same failed element.
        key={attempt}
        src={retrySrc}
        alt={alt}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
        // A warmed/cached image can finish before React attaches onLoad — the
        // ref callback catches that so it doesn't stay at opacity-0.
        ref={(node) => {
          if (node?.complete && node.naturalWidth > 0) setStatus("loaded");
        }}
        onLoad={() => setStatus("loaded")}
        onError={() => {
          if (attempt < 1) {
            setAttempt(1);
            setStatus("loading");
          } else {
            setStatus("error");
          }
        }}
        style={objectPosition ? { objectPosition } : undefined}
        className={`${className} ${status === "loaded" ? "opacity-100" : "opacity-0"}`}
      />
    </>
  );
}
