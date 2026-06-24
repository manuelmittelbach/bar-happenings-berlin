import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Centralized scroll restoration for the app-shell layout.
 *
 * The app scrolls inside a single inner container (Layout's `<main>`), not the
 * document — so the window never scrolls. This hook owns that container's scroll
 * the way the old window-based ScrollManager owned the document:
 *   - fresh navigations (PUSH/REPLACE) start at the top
 *   - back/forward (POP) restores the saved position
 *
 * Resetting an element's `scrollTop` (vs `window.scrollTo`) is what fixes the iOS
 * Safari bug: Safari reliably honors `node.scrollTop = 0` even within the
 * address-bar zone, where a programmatic window scroll-to-top gets swallowed.
 *
 * On the locked-viewport pages (/events, /map) `<main>` is `overflow-hidden`, so
 * its `scrollTop` is pinned at 0 and every write here is a harmless no-op — those
 * pages drive their own inner scroller and own scroll memory.
 */
export function useScrollRestoration(scrollerRef: RefObject<HTMLElement>) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef(new Map<string, number>());
  const prevPathname = useRef(location.pathname);

  // Save the live scrollTop on every scroll, keyed by location.key (so back/forward
  // can return the user to where they were on each distinct history entry).
  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const key = location.key;
    const onScroll = () => positions.current.set(key, node.scrollTop);
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, [scrollerRef, location.key]);

  useLayoutEffect(() => {
    const node = scrollerRef.current;
    const pathnameChanged = prevPathname.current !== location.pathname;
    prevPathname.current = location.pathname;
    // Filter-only updates (?q=, ?c=, etc.) don't change the pathname — leave the
    // scroll where the user is. Only real page navigations reset/restore.
    if (!pathnameChanged || !node) return;

    if (navigationType === "POP") {
      // Back/forward: restore the saved position across a few requestAnimationFrame
      // retries so it survives late layout (images / sticky headers settling),
      // generalizing the per-page approach Index already uses for its own scroller.
      const target = positions.current.get(location.key) ?? 0;
      let attempts = 0;
      let frame = requestAnimationFrame(function tryRestore() {
        const el = scrollerRef.current;
        if (el) {
          el.scrollTop = target;
          const reached = Math.abs(el.scrollTop - target) <= 1;
          const atMax = el.scrollTop >= el.scrollHeight - el.clientHeight - 1;
          if (reached || atMax) return;
        }
        if (attempts++ < 20) frame = requestAnimationFrame(tryRestore);
      });
      return () => cancelAnimationFrame(frame);
    }

    // PUSH / REPLACE: a fresh navigation starts at the top. `node.scrollTop = 0` is
    // honored reliably by iOS Safari (no address-bar-zone swallow) — this is the fix.
    node.scrollTop = 0;
  }, [scrollerRef, location.key, location.pathname, navigationType]);
}
