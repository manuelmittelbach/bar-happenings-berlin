import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Apple, ArrowRight, ArrowUpRight } from "lucide-react";

/**
 * LandingDraft — single-viewport marketing landing for /landing.
 *
 * Locked to 100dvh, no scroll. Slim top nav · centered hero with floating
 * preview card cluster on the right · slim legal strip pinned to the bottom.
 * Card cluster hides below lg — small viewports get the text + CTAs centered.
 *
 * Footer-treatment A/B via ?footer=ink (default: black slab) or ?footer=cream
 * (paper strip with hairline). Tiny dev toggle pinned bottom-right swaps in
 * place so the design call can be made by eye, not by argument.
 */
export default function LandingDraft() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const footerMode = searchParams.get("footer") === "cream" ? "cream" : "ink";
  const setFooterMode = (mode: "ink" | "cream") => {
    const next = new URLSearchParams(searchParams);
    if (mode === "ink") next.delete("footer");
    else next.set("footer", "cream");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      {/* ─── TOP NAV ─── */}
      <nav className="shrink-0 border-b-2 border-foreground bg-background">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/landing" className="flex items-center gap-2.5">
            <span
              className="heading-display inline-flex items-center leading-none"
              style={{ fontSize: 20, gap: 8 }}
            >
              Inside
              <span
                aria-hidden="true"
                className="rounded-full bg-accent"
                style={{ width: 7, height: 7 }}
              />
              Bars
            </span>
            <span className="mono-label hidden text-[10px] text-foreground/45 md:inline">
              — Berlin Edition
            </span>
          </Link>

          {/* Right-side nav — mirrors the Index Header navItems verbatim:
              List · Map · For organizer (no Sign In, matching the product
              header convention). */}
          <div className="flex items-center gap-7">
            <Link
              to="/"
              className="mono-label text-foreground/70 transition-colors hover:text-foreground"
            >
              List
            </Link>
            <Link
              to="/map"
              className="mono-label text-foreground/70 transition-colors hover:text-foreground"
            >
              Map
            </Link>
            <Link
              to="/for-bars"
              className="mono-label text-foreground/70 transition-colors hover:text-foreground"
            >
              For organizer
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── HERO (fills remaining viewport) ─── */}
      <section className="relative isolate flex flex-1 min-h-0 items-center overflow-hidden">
        {/* faint grid paper texture */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage:
                "radial-gradient(ellipse at 32% 50%, black 28%, transparent 82%)",
              WebkitMaskImage:
                "radial-gradient(ellipse at 32% 50%, black 28%, transparent 82%)",
            }}
          />
        </div>

        <div className="container relative grid w-full grid-cols-1 items-center gap-8 py-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          {/* ── LEFT: copy ── */}
          <div>
            <motion.h1
              className="heading-display m-0 leading-[0.92]"
              style={{ fontSize: "clamp(40px, 5.6vw, 78px)" }}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.15 }}
            >
              EVERY SMALL<br />
              THING{" "}
              <span
                className="heading-editorial italic lowercase text-accent"
                style={{ letterSpacing: "-0.01em" }}
              >
                happening
              </span>
              <br />
              IN BERLIN BARS<span className="text-accent">.</span>
            </motion.h1>

            <motion.p
              className="font-body mt-5 max-w-[500px] text-[15px] leading-[1.5] text-foreground/70 text-balance md:text-[17px]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              Quiz nights, jazz trios, open mics, queer karaoke — mapped across independent
              Berlin bars.
            </motion.p>

            <motion.div
              className="mt-6 flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.42 }}
            >
              <button
                type="button"
                onClick={() => navigate("/map")}
                className="group inline-flex h-12 items-center justify-center gap-2.5 border-2 border-foreground bg-foreground px-6 font-mono uppercase text-background transition-all hover:bg-background hover:text-foreground active:scale-[0.98]"
                style={{ fontSize: 12, letterSpacing: "0.14em" }}
              >
                <span>Open the map</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="group inline-flex h-12 items-center justify-center gap-2.5 border-2 border-foreground bg-background px-6 font-mono uppercase text-foreground transition-all hover:bg-foreground hover:text-background active:scale-[0.98]"
                style={{ fontSize: 12, letterSpacing: "0.14em" }}
              >
                Browse tonight
              </button>
            </motion.div>

            {/* tertiary — iOS app */}
            <motion.a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="group mt-3 inline-flex items-center gap-2 text-foreground/65 transition-colors hover:text-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.55 }}
            >
              <Apple className="h-[14px] w-[14px]" strokeWidth={2.2} />
              <span
                className="font-mono uppercase"
                style={{ fontSize: 11, letterSpacing: "0.14em" }}
              >
                Also on iOS
              </span>
              <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </motion.a>
          </div>

          {/* ── RIGHT: floating preview card cluster (lg+) ── */}
          <motion.div
            className="relative hidden h-[400px] lg:block"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* secondary card, stacked behind */}
            <div
              className="absolute right-[6%] top-[8%] w-[240px] border-2 border-foreground bg-card shadow-[8px_8px_0_0_#0f0f0f]"
              style={{ transform: "rotate(6deg)" }}
            >
              <div className="flex items-center gap-2 border-b-2 border-foreground px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#7c3aed" }} />
                <span className="mono-label text-[10px] text-foreground/70">Wed · 21:00</span>
              </div>
              <div className="px-4 py-3">
                <p className="heading-display text-[16px] leading-tight">PUB QUIZ // EN/DE</p>
                <p className="font-body mt-1 text-[12px] text-foreground/70">
                  Das Hotel · Kreuzberg
                </p>
              </div>
            </div>

            {/* hand-drawn arrow + annotation */}
            <span
              className="absolute right-[26%] top-[-4px] font-mono text-[11px] uppercase tracking-wider text-foreground/60"
              style={{ transform: "rotate(-5deg)" }}
            >
              free tonight
            </span>
            <svg
              aria-hidden
              viewBox="0 0 180 110"
              className="absolute right-[10%] top-[8px] w-[130px] text-foreground/55"
              style={{ transform: "rotate(8deg)" }}
            >
              <path
                d="M10 12 Q 70 6, 95 38 T 158 90"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="5 4"
              />
              <path
                d="M158 90 L 148 82 M158 90 L 152 96"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            </svg>

            {/* PRIMARY card */}
            <motion.div
              className="absolute left-[2%] top-[6%] w-[340px] border-2 border-foreground bg-card shadow-[12px_12px_0_0_#0f0f0f]"
              style={{ transform: "rotate(-3deg)" }}
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="flex items-center justify-between border-b-2 border-foreground px-5 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-75" />
                    <span className="relative h-2 w-2 rounded-full bg-accent" />
                  </span>
                  <span className="mono-label text-[10px]">Live · 19:30</span>
                </div>
                <span
                  className="stamp border-accent text-[9px] text-accent"
                  style={{ transform: "rotate(4deg)" }}
                >
                  Tonight
                </span>
              </div>

              <div className="px-5 py-4">
                <p className="mono-label mb-1.5 text-[10px] text-foreground/55">Open Mic</p>
                <h3 className="heading-display mb-2 text-[26px] leading-[0.95]">
                  JAZZ TRIO<br />+ 3 POETS
                </h3>
                <p className="font-body text-[13px] leading-[1.45] text-foreground/75">
                  Bring your own poem. Or just your beer. Three sets, no cover, donation jar
                  by the bar.
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-foreground/15 pt-3">
                  <div>
                    <p className="font-body text-[13px] font-semibold">Klunkerkranich</p>
                    <p className="font-body text-[12px] text-foreground/55">
                      Neukölln · 8 min walk
                    </p>
                  </div>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </motion.div>

            {/* sticky-note sticker */}
            <div
              className="absolute bottom-[4%] right-[2%] border-2 border-foreground bg-accent px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-accent-foreground shadow-[6px_6px_0_0_#0f0f0f]"
              style={{ transform: "rotate(8deg)" }}
            >
              31 spots open
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── SLIM LEGAL STRIP ─── two treatments, A/B'd via ?footer=… */}
      {footerMode === "ink" ? (
        <footer className="shrink-0 bg-foreground text-background">
          <div className="container flex h-11 flex-wrap items-center justify-between gap-2 text-background/60">
            <span className="mono-label">
              <span className="font-bold text-background">147</span> bars{" "}
              <span className="text-background/30">·</span>{" "}
              <span className="font-bold text-background">31</span> tonight{" "}
              <span className="text-background/30">·</span>{" "}
              <span className="font-bold text-background">12</span> Kieze
            </span>
            <div className="mono-label flex flex-wrap gap-x-5 gap-y-1">
              <Link to="/about" className="hover:text-accent">About</Link>
              <Link to="/instagram" className="hover:text-accent">Instagram</Link>
              <Link to="/contact" className="hover:text-accent">Contact</Link>
              <Link to="/impressum" className="hover:text-accent">Impressum</Link>
              <Link to="/datenschutz" className="hover:text-accent">Datenschutz</Link>
            </div>
          </div>
        </footer>
      ) : (
        <footer className="shrink-0 border-t-2 border-foreground bg-background">
          <div className="container flex h-11 flex-wrap items-center justify-between gap-2 text-foreground/55">
            <span className="mono-label">
              <span className="font-bold text-foreground">147</span> bars{" "}
              <span className="text-foreground/25">·</span>{" "}
              <span className="font-bold text-foreground">31</span> tonight{" "}
              <span className="text-foreground/25">·</span>{" "}
              <span className="font-bold text-foreground">12</span> Kieze
            </span>
            <div className="mono-label flex flex-wrap gap-x-5 gap-y-1">
              <Link to="/about" className="hover:text-accent">About</Link>
              <Link to="/instagram" className="hover:text-accent">Instagram</Link>
              <Link to="/contact" className="hover:text-accent">Contact</Link>
              <Link to="/impressum" className="hover:text-accent">Impressum</Link>
              <Link to="/datenschutz" className="hover:text-accent">Datenschutz</Link>
            </div>
          </div>
        </footer>
      )}

      {/* ─── DEV A/B TOGGLE — pinned bottom-right, doesn't disturb composition.
              Remove this block once the footer treatment is locked in. */}
      <div
        className="fixed bottom-3 right-3 z-50 flex border-2 border-foreground bg-background shadow-[3px_3px_0_0_#0f0f0f]"
        style={{ fontSize: 10 }}
      >
        <button
          type="button"
          onClick={() => setFooterMode("ink")}
          className={`mono-label px-3 py-1.5 transition-colors ${
            footerMode === "ink"
              ? "bg-foreground text-background"
              : "text-foreground/60 hover:text-foreground"
          }`}
        >
          Ink
        </button>
        <button
          type="button"
          onClick={() => setFooterMode("cream")}
          className={`mono-label border-l-2 border-foreground px-3 py-1.5 transition-colors ${
            footerMode === "cream"
              ? "bg-foreground text-background"
              : "text-foreground/60 hover:text-foreground"
          }`}
        >
          Cream
        </button>
      </div>
    </div>
  );
}
