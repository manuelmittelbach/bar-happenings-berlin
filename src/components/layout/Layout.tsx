import { useMemo, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import BottomTabBar from "@/components/layout/BottomTabBar";
import { useIsNative } from "@/hooks/useIsNative";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";
import { useVenues, useEvents } from "@/hooks/useEvents";
import { usePrefetchImages } from "@/hooks/usePrefetchImages";
import { useIsMobile } from "@/hooks/use-mobile";
import { berlinDateString } from "@/lib/dateFormat";
import { buildTonightEventsMap, groupVenuesByHood } from "@/lib/venueDisplayOrder";

export default function Layout() {
  const { pathname } = useLocation();
  const isMap = pathname === "/map";

  // Warm the browser image cache for the bar covers most likely to sit
  // above the fold on /bars — ~4 on phone, ~6 on desktop — so the Bars tab
  // renders its first screen instantly from cache. Everything below the
  // fold loads lazily on scroll once the user is actually there.
  //
  // We deliberately prefetch only this handful, not all ~200 covers.
  // groupVenuesByHood is the exact same ordering BarsList renders (fixed
  // hood order, tonight-active bars first within each hood), so flattening
  // it and taking the first N gives precisely the covers that sit above the
  // fold when the user taps the tab — the preload can't drift from the
  // display. Prefetch is skipped on /map where map tiles compete for the
  // same network budget. Both useVenues and useEvents share the React Query
  // cache with /bars, so this adds no extra requests.
  const { data: venuesData = [] } = useVenues();
  const { data: eventsData = [] } = useEvents();
  const isMobile = useIsMobile();
  const prefetchCount = isMobile ? 4 : 6;
  const venueImageUrls = useMemo(() => {
    const today = berlinDateString();
    const tonightByVenue = buildTonightEventsMap(eventsData, today);
    return groupVenuesByHood(venuesData, tonightByVenue)
      .flatMap((h) => h.items)
      .map((v) => v.image)
      .filter((u): u is string => !!u)
      .slice(0, prefetchCount);
  }, [venuesData, eventsData, prefetchCount]);
  usePrefetchImages(venueImageUrls, !isMap);

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

  // The single app-shell scroller. Layout is a persistent layout route (it does
  // NOT unmount across sibling route changes), so this ref points at one durable
  // node for the whole session — the centralized restoration hook saves/restores
  // against it. On locked pages (/events, /map) <main> is overflow-hidden, so its
  // scrollTop is pinned at 0 and the hook's writes are harmless no-ops there.
  const mainRef = useRef<HTMLElement>(null);
  useScrollRestoration(mainRef);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
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
        ref={mainRef}
        className={
          lockedViewport
            ? "flex-1 flex flex-col min-h-0 overflow-hidden"
            : "flex-1 overflow-y-auto overflow-x-hidden min-h-0"
        }
        style={
          isNative && !lockedViewport
            ? { paddingBottom: "var(--tab-bar-h)", overscrollBehavior: "contain" }
            : { overscrollBehavior: "contain" }
        }
      >
        {lockedViewport ? (
          // Locked pages (/events, /map) own their inner scroller + footer.
          <Outlet />
        ) : (
          // App-shell pages scroll inside <main>. The min-h-full wrapper lets the
          // footer pin to the bottom on short pages (mt-auto) and sit at the natural
          // end on tall ones.
          <div className="flex flex-col min-h-full">
            <div className="flex-1">
              <Outlet />
            </div>
            {!isNative && (
              <div className="mt-auto">
                <Footer />
              </div>
            )}
          </div>
        )}
      </main>
      {isNative ? <BottomTabBar /> : null}
    </div>
  );
}
