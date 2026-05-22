import { useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import BottomTabBar from "@/components/layout/BottomTabBar";
import { useIsNative } from "@/hooks/useIsNative";
import { useVenues } from "@/hooks/useEvents";
import { usePrefetchImages } from "@/hooks/usePrefetchImages";

export default function Layout() {
  const { pathname } = useLocation();
  const isMap = pathname === "/map";

  // Warm the browser image cache for bar cover photos from any Layout-
  // wrapped surface (events, map, bars itself, detail pages) so the Bars
  // tab renders covers instantly from cache. useVenues shares the React
  // Query cache with /events so this adds no extra network for the venue
  // list itself — only the cover images. requestIdleCallback gates the
  // queue to genuine idle moments, so the map's tile fetches still win
  // when the user is actively panning.
  const { data: venuesData = [] } = useVenues();
  const venueImageUrls = useMemo(
    () => venuesData.map((v) => v.image).filter((u): u is string => !!u),
    [venuesData],
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
