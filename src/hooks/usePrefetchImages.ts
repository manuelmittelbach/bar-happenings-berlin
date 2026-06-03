import { useEffect } from "react";

// Module-level dedupe: once a URL has been prefetched in this session, no
// subsequent caller re-fetches it. Survives component remounts and route
// changes, gets reset only on full page reload (which the browser cache
// covers anyway).
const prefetched = new Set<string>();

const MAX_PARALLEL = 6;

/**
 * Imperatively warm the browser cache for a single image, right now (no idle
 * deferral). Used on event-card interaction (hover / press) so the detail
 * page's hero photo is often already cached by the time it mounts, instead
 * of visibly popping in after navigation. Shares the module-level dedupe set
 * with usePrefetchImages, so a URL warmed here won't be re-requested there.
 */
export function prefetchImage(url: string | null | undefined): void {
  if (!url || prefetched.has(url)) return;
  prefetched.add(url);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
}

type IdleScheduler = (cb: () => void) => void;

const scheduleIdle: IdleScheduler =
  typeof window !== "undefined" && "requestIdleCallback" in window
    ? (cb) =>
        (window as Window & {
          requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void;
        }).requestIdleCallback(cb, { timeout: 2000 })
    : (cb) => setTimeout(cb, 200);

/**
 * Warm the browser image cache for a set of URLs after the page is idle.
 *
 * Used on /events to pre-load bar cover photos so /bars renders from cache
 * the moment the user taps the tab, instead of fetching every original
 * full-size image on demand. Prefetched URLs are deduped across hook
 * instances, so multiple consumers don't double-request the same image.
 *
 * Caller is responsible for memoizing `urls` — the effect re-runs whenever
 * the array reference changes. Pass `enabled: false` to skip the prefetch
 * on bandwidth-sensitive surfaces (e.g. the Map page, where tiles compete
 * for the same network budget).
 */
export function usePrefetchImages(urls: string[], enabled: boolean = true): void {
  useEffect(() => {
    if (!enabled) return;
    const fresh = urls.filter((u) => u && !prefetched.has(u));
    if (fresh.length === 0) return;

    let cancelled = false;
    const queue = fresh.slice();
    let active = 0;

    const startNext = () => {
      while (!cancelled && active < MAX_PARALLEL && queue.length > 0) {
        const url = queue.shift()!;
        // Mark as prefetched up-front so a remount during the request
        // doesn't kick off a duplicate fetch. If the response errors,
        // the cache miss on the eventual <img src> render is benign —
        // it just falls back to a normal request.
        prefetched.add(url);
        active++;
        const img = new Image();
        img.decoding = "async";
        const done = () => {
          active--;
          startNext();
        };
        img.onload = done;
        img.onerror = done;
        img.src = url;
      }
    };

    scheduleIdle(startNext);

    return () => {
      cancelled = true;
    };
  }, [urls, enabled]);
}
