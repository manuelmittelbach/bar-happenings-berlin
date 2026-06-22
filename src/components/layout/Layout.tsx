import { useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import BottomTabBar from "@/components/layout/BottomTabBar";
import { useIsNative } from "@/hooks/useIsNative";
import { useVenues } from "@/hooks/useEvents";
import { usePrefetchImages } from "@/hooks/usePrefetchImages";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Layout() {
  const { pathname } = useLocation();
  const isMap = pathname === "/map";

  // Warm the browser image cache for the bar covers most likely to sit
  // above the fold on /bars — ~4 on phone, ~6 on desktop — so the Bars tab
  // renders its first screen instantly from cache. Everything below the
  // fold loads lazily on scroll once the user is actually there.
  //
  // We deliberately prefetch only this handful, not all ~200 covers:
  // Layout wraps every route (incl. the landing page most visitors never
  // click past), so prefetching the full set warmed 200 full-res images on
  // every visit and was the bulk of Supabase "cached egress". Note the
  // slice uses raw venue order, which won't exactly match the hood-grouped
  // order /bars displays — that's fine, it's a best-effort warm and the
  // page's own eager/lazy loading covers any miss. useVenues shares the
  // React Query cache with /events so this adds no extra network for the
  // list data itself. requestIdleCallback gates the queue to genuine idle
  // moments, so the map's tile fetches still win when the user is panning.
  const { data: venuesData = [] } = useVenues();
  const isMobile = useIsMobile();
  const prefetchCount = isMobile ? 4 : 6;
  const venueImageUrls = useMemo(
    () =>
      venuesData
        .map((v) => v.image)
        .filter((u): u is string => !!u)
        .slice(0, prefetchCount),
    [venuesData, prefetchCount],
  );
  usePrefetchImages(venueImageUrls);

  // Index uses the same locked-viewport architecture as Map: the page
  // doesn't scroll, only an internal list container does. Locks the day +
  // category chrome at the top of the viewport so it can't drift when the
  // mobile browser URL bar collapses or the page header's backdrop-filter
  // repaints under it. Footer is dropped here and re-rendered inside
  // Index's scroll container (so users still hit it at the end of the
  // list), the same way Map drops it altogether.
  const isIndex = pathname === "/events";
  const lockedViewport = isMap || isIndex;
  const isNative = useIsNative();

  return (
    <div className={`flex flex-col ${lockedViewport ? "h-[100dvh] overflow-hidden" : "min-h-screen"}`}>
      {/* Native context drops the top header entirely — `--header-h` is
          overridden to just env(safe-area-inset-top) so notch-aware stickies
          (category bar) still pin at the right height with nothing above.
          The spacer is sticky + bg-background + z-50 (above the day/category
          chrome at z-40) so the notch zone always stays opaque cream; if
          left non-sticky, content scrolls through the bare safe-area
          window and reads as a layout glitch under the status bar. */}
      {isNative ? (
        <div
          className="sticky top-0 z-50 bg-background"
          style={{ height: "env(safe-area-inset-top)", flexShrink: 0 }}
        />
      ) : (
        <Header />
      )}
      <main
        className="flex-1 flex flex-col min-h-0"
        style={isNative && !lockedViewport ? { paddingBottom: "var(--tab-bar-h)" } : undefined}
      >
        <Outlet />
      </main>
      {isNative ? <BottomTabBar /> : !lockedViewport && <Footer />}
    </div>
  );
}
