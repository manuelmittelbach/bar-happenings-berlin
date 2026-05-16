import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Apple, ArrowRight, ArrowUpRight } from "lucide-react";
import Header from "@/components/layout/Header";
import { useEvents, useCategories, useVenues } from "@/hooks/useEvents";
import { berlinDateString } from "@/lib/dateFormat";
import { isEventStillOnline, isLiveNow } from "@/lib/eventStatus";
import { isFreeEntry, isDonationEntry } from "@/lib/entryInfo";
import { cleanEventTitle } from "@/lib/cleanTitle";
import type { BarlinEvent } from "@/types/event";
import type { CategoryRow } from "@/lib/supabaseQueries";

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

  // ─── Live data — drives the hero card stack + footer counts ───
  // useEvents / useVenues / useCategories all share the React-Query cache
  // with the rest of the app, so navigating from /landing to / doesn't
  // re-fetch. Falls back gracefully to empty arrays while loading.
  const { data: eventsData = [] } = useEvents();
  const { data: venuesData = [] } = useVenues();
  const { data: categoriesData = [] } = useCategories();
  const today = berlinDateString();

  // Hero card seed — stable across renders within a single visit, fresh
  // on each page load. Lets the landing show different events each visit
  // without re-shuffling on every re-render.
  const [shuffleSeed] = useState(() => Math.random());

  // Carousel pool — up to 8 of today's events, shuffled deterministically
  // per visit. The hero stack cycles through this pool every few seconds;
  // smaller cap keeps the loop short enough to feel intentional rather
  // than an endless slideshow.
  const HERO_POOL_SIZE = 8;
  const heroPool = useMemo(() => {
    const todaysEvents = eventsData.filter(
      (e) =>
        e.date === today &&
        isEventStillOnline(e) &&
        e.status !== "canceled",
    );
    let seed = Math.floor(shuffleSeed * 1e9);
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const shuffled = [...todaysEvents].sort(() => rand() - 0.5);
    // Spread across distinct venues first so consecutive cards in the
    // cycle don't share a bar — pad with remaining events if the pool
    // still has room.
    const picks: BarlinEvent[] = [];
    const seenVenues = new Set<string>();
    for (const e of shuffled) {
      if (!seenVenues.has(e.venue)) {
        picks.push(e);
        seenVenues.add(e.venue);
      }
      if (picks.length === HERO_POOL_SIZE) break;
    }
    if (picks.length < HERO_POOL_SIZE) {
      for (const e of shuffled) {
        if (!picks.includes(e)) picks.push(e);
        if (picks.length === HERO_POOL_SIZE) break;
      }
    }
    return picks;
  }, [eventsData, today, shuffleSeed]);

  // Carousel cycle — the stack advances one slot every CYCLE_MS. With a
  // linear easing and a transition duration just under the interval, the
  // cards drift in continuous, constant-velocity motion: no perceptible
  // "rest" at each slot. Skips entirely when the pool is too small.
  const CYCLE_MS = 28000;
  const [cycleIndex, setCycleIndex] = useState(0);
  useEffect(() => {
    if (heroPool.length < 2) return;
    const id = setInterval(() => setCycleIndex((i) => i + 1), CYCLE_MS);
    return () => clearInterval(id);
  }, [heroPool.length]);

  // Visible slice — three events visible at any time. With a pool of N,
  // (cycleIndex, cycleIndex+1, cycleIndex+2) modulo N gives us primary,
  // secondary, tertiary. AnimatePresence handles the enter/exit transitions
  // when this array changes on each cycle tick.
  const visibleCards = useMemo(() => {
    const N = heroPool.length;
    if (N === 0) return [] as { event: BarlinEvent; role: "primary" | "secondary" | "tertiary" }[];
    const slots: ("primary" | "secondary" | "tertiary")[] = ["primary", "secondary", "tertiary"];
    const count = Math.min(3, N);
    return slots.slice(0, count).map((role, offset) => ({
      event: heroPool[(cycleIndex + offset) % N],
      role,
    }));
  }, [heroPool, cycleIndex]);

  // Footer stats — live counts pulled from the actual dataset, not magic
  // numbers. Bars = total venues. Tonight = today's events that haven't
  // ended yet. Kieze = distinct neighborhoods across the bar list.
  const barsCount = venuesData.length;
  const tonightCount = useMemo(
    () =>
      eventsData.filter(
        (e) =>
          e.date === today &&
          isEventStillOnline(e) &&
          e.status !== "canceled",
      ).length,
    [eventsData, today],
  );
  const kiezeCount = useMemo(() => {
    const s = new Set<string>();
    for (const v of venuesData) if (v.neighborhood) s.add(v.neighborhood);
    return s.size;
  }, [venuesData]);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      {/* ─── TOP NAV ─── shared product Header, identical to / and /map */}
      <div className="shrink-0">
        <Header />
      </div>

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

          {/* ── RIGHT: cycling preview cluster (lg+) ──
              3-card stack that rotates through tonight's pool: new card
              enters from behind the tertiary slot, each existing card
              advances one slot forward (tertiary → secondary → primary),
              and the primary card exits forward-down. All real Supabase
              data; smooth spring-eased transition per cycle tick. */}
          <motion.div
            className="relative hidden h-[460px] w-full lg:block"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <AnimatePresence mode="popLayout">
              {visibleCards.map(({ event, role }) => {
                const slot = SLOT_TRANSFORMS[role];
                return (
                  <motion.div
                    key={event.id}
                    initial={SLOT_TRANSFORMS.enter}
                    animate={{
                      x: slot.x,
                      y: slot.y,
                      rotate: slot.rotate,
                      scale: slot.scale,
                      opacity: 1,
                    }}
                    // Exit applies the same per-slot delta (Δx≈-90,
                    // Δy≈+70, Δrotate≈-7°, Δscale≈+0.12) as a normal
                    // slot transition, and uses the *same duration*
                    // as the slot drift below. Result: angular and
                    // linear velocity stay constant across enter →
                    // tertiary → secondary → primary → exit. The card
                    // never accelerates, never pauses, just drifts and
                    // rotates at one steady speed throughout its life.
                    // zIndex jumps to 99 instantly so the fading card
                    // stays on top of whatever's animating into primary.
                    exit={{
                      x: -70,
                      y: 200,
                      rotate: -10,
                      scale: 1.12,
                      opacity: 0,
                      zIndex: 99,
                      transition: {
                        duration: 28,
                        ease: "linear",
                        zIndex: { duration: 0 },
                      },
                    }}
                    transition={{ duration: 28, ease: "linear" }}
                    className="absolute left-0 top-0 w-[360px] border-2 border-foreground bg-background shadow-[12px_12px_0_0_#0f0f0f]"
                    style={{
                      padding: "22px 20px 18px",
                      zIndex: slot.z,
                      transformOrigin: "center center",
                    }}
                  >
                    <HeroEventCard event={event} categories={categoriesData} variant="primary" />
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Live-count sticker — stays put while cards cycle around it */}
            {tonightCount > 0 && (
              <div
                className="absolute bottom-[1%] right-[3%] border-2 border-foreground bg-accent px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-accent-foreground shadow-[6px_6px_0_0_#0f0f0f]"
                style={{ transform: "rotate(8deg)", zIndex: 10 }}
              >
                {tonightCount} tonight
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* ─── SLIM LEGAL STRIP ─── two treatments, A/B'd via ?footer=…
          Counts are live: bars = total venues, tonight = today's events
          still online, Kieze = distinct neighborhoods. */}
      {footerMode === "ink" ? (
        <footer className="shrink-0 bg-foreground text-background">
          <div className="container flex h-11 flex-wrap items-center justify-between gap-2 text-background/60">
            <span className="mono-label">
              <span className="font-bold text-background">{barsCount}</span> bars{" "}
              <span className="text-background/30">·</span>{" "}
              <span className="font-bold text-background">{tonightCount}</span> tonight{" "}
              <span className="text-background/30">·</span>{" "}
              <span className="font-bold text-background">{kiezeCount}</span> Kieze
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
              <span className="font-bold text-foreground">{barsCount}</span> bars{" "}
              <span className="text-foreground/25">·</span>{" "}
              <span className="font-bold text-foreground">{tonightCount}</span> tonight{" "}
              <span className="text-foreground/25">·</span>{" "}
              <span className="font-bold text-foreground">{kiezeCount}</span> Kieze
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

/* Carousel slot transforms — each visible card animates between these
 * three positions (primary at front, secondary in middle, tertiary at
 * back) plus enter (behind tertiary, fully transparent). Exit isn't a
 * dedicated slot: the leaving card fades in place at the primary slot
 * (handled inline at the JSX site). All values are absolute translations
 * from the container's top-left corner; the cards share a 360px base
 * width and differ only in scale/rotation/position so the inner chrome
 * stays identical across slots. */
const SLOT_TRANSFORMS = {
  primary:   { x:  20, y: 130, rotate:  -3, scale: 1.00, z: 3 },
  secondary: { x: 110, y:  60, rotate:   5, scale: 0.88, z: 2 },
  tertiary:  { x: 200, y:   0, rotate:  11, scale: 0.76, z: 1 },
  // Incoming: tucked further back-right than tertiary, fully transparent.
  // Animates over the full cycle duration so a new card slowly emerges
  // from behind rather than popping in.
  enter:     { x: 300, y: -60, rotate:  18, scale: 0.60, opacity: 0 },
} as const;

/* HeroEventCard — inner chrome for each layered preview card. Mirrors the
 * real EventCard system (accent strip, mono meta row with Now indicator,
 * body-font bold title, hairline venue line) at three size variants. */
function HeroEventCard({
  event,
  categories,
  variant,
}: {
  event: BarlinEvent;
  categories: CategoryRow[];
  variant: "primary" | "secondary" | "tertiary";
}) {
  const cat = categories.find((c) => c.id === event.category);
  const live = variant === "primary" && isLiveNow(event);
  const free = isFreeEntry(event.entryInfo);
  const donation = !free && isDonationEntry(event.entryInfo);
  const title = cleanEventTitle(event.title, event.venue);

  const titleSize = variant === "primary" ? 22 : variant === "secondary" ? 17 : 15;
  const venueSize = variant === "primary" ? 14 : variant === "secondary" ? 13 : 12;
  const showDescription = variant === "primary" && !!event.description;

  return (
    <>
      <span className="absolute left-0 right-0 top-0 h-1.5 bg-accent" />
      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em]">
        {event.startTime && (
          <>
            {live ? (
              <span className="inline-flex items-center gap-1.5 text-accent">
                <span className="relative inline-flex h-2 w-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-75" />
                  <span className="relative inline-block h-2 w-2 rounded-full bg-accent" />
                </span>
                Now
              </span>
            ) : (
              <span>{event.startTime}</span>
            )}
            <span className="text-muted-foreground">·</span>
          </>
        )}
        <span style={cat?.color ? { color: cat.color } : { color: "var(--accent)" }}>
          {cat?.label ?? event.category}
        </span>
        {free && (
          <span className="ml-0.5 border border-current px-1.5 py-0.5 tracking-[0.1em] text-muted-foreground text-[9px]">
            Free
          </span>
        )}
        {donation && (
          <span className="ml-0.5 border border-current px-1.5 py-0.5 tracking-[0.1em] text-muted-foreground text-[9px]">
            Donation
          </span>
        )}
      </div>
      <h3
        className="font-body mt-2 font-bold leading-[1.18] break-words line-clamp-2"
        style={{ fontSize: titleSize }}
      >
        {title}
      </h3>
      <div
        className="font-body mt-1 flex flex-wrap items-center gap-1.5 text-foreground/80"
        style={{ fontSize: venueSize }}
      >
        <span className="break-words">{event.venue}</span>
        {event.neighborhood && (
          <>
            <span className="opacity-50">·</span>
            <span>{event.neighborhood}</span>
          </>
        )}
      </div>
      {showDescription && (
        <p className="font-body mt-2 text-[13px] leading-[1.45] text-muted-foreground line-clamp-2">
          {event.description}
        </p>
      )}
    </>
  );
}
