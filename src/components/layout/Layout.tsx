import { Outlet, useLocation } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import BottomTabBar from "@/components/layout/BottomTabBar";
import { useIsNative } from "@/hooks/useIsNative";

export default function Layout() {
  const { pathname } = useLocation();
  const isMap = pathname === "/map";
  const isNative = useIsNative();

  return (
    <div className={`flex flex-col ${isMap ? "h-[100dvh] overflow-hidden" : "min-h-screen"}`}>
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
        style={isNative && !isMap ? { paddingBottom: "var(--tab-bar-h)" } : undefined}
      >
        <Outlet />
      </main>
      {isNative ? <BottomTabBar /> : !isMap && <Footer />}
    </div>
  );
}
