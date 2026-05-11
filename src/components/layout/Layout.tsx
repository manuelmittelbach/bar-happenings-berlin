import { Outlet, useLocation } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

/* Magazine spine layout — the page is laid out as flex row with a white
 * aside on the left and the cream content area on the right. The aside
 * carries a small rotated brand mark so the spine reads as deliberate
 * editorial design rather than empty padding. Mobile is full-bleed —
 * the spine collapses entirely so narrow viewports give the content all
 * the horizontal space they have. */
export default function Layout() {
  const { pathname } = useLocation();
  const isMap = pathname === "/map";

  return (
    <div
      className={`flex bg-white ${
        isMap ? "h-[100dvh] overflow-hidden" : "min-h-screen"
      }`}
    >
      {/* Thin cream edge stripe — sits at the very left of the page on
          md+, "wrapping" the white spine and making it read as a magazine
          binding rather than a stray empty margin. Same cream as the
          content area, so the eye perceives a thin cream "fold" around
          the spine. */}
      <div
        aria-hidden="true"
        className="hidden md:block md:w-1 lg:w-1.5 shrink-0 bg-background"
      />

      {/* Spine — hidden on Mobile, 32px (md) / 48px (lg) on Desktop.
          A small rotated label sits inside the spine giving it a
          purpose (Berlin's independent bar guide) — turns the white
          area from "margin" into "editorial element". */}
      <aside
        aria-hidden="true"
        className="hidden md:flex md:w-8 lg:w-12 shrink-0 items-center justify-center"
      >
        <span
          className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground whitespace-nowrap"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Berlin's independent bar guide · {new Date().getFullYear()}
        </span>
      </aside>

      <div
        className={`flex-1 flex flex-col bg-background min-w-0 ${
          isMap ? "overflow-hidden" : ""
        }`}
      >
        <Header />
        <main className="flex-1 flex flex-col min-h-0">
          <Outlet />
        </main>
        {!isMap && <Footer />}
      </div>
    </div>
  );
}
