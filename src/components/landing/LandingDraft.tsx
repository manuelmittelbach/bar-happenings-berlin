import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { /* Apple, ArrowUpRight, Play, */ ArrowRight } from "lucide-react"; // Apple/ArrowUpRight/Play: uncomment with store links
import { useEvents, useCategories, useVenues } from "@/hooks/useEvents";
import { setFilter } from "@/lib/useFilterParams";
import { berlinDateString, berlinDateStringOffset } from "@/lib/dateFormat";
import { isEventStillOnline, isLiveNow } from "@/lib/eventStatus";
import { isFreeEntry, isDonationEntry } from "@/lib/entryInfo";
import { cleanEventTitle } from "@/lib/cleanTitle";
import type { BarlinEvent } from "@/types/event";
import type { CategoryRow } from "@/lib/supabaseQueries";

/**
 * LandingDraft — marketing landing rendered at `/`.
 *
 * Slim top nav · centered hero with floating preview card cluster on the
 * right · shared site Footer pinned below. Card cluster hides below lg —
 * small viewports get the text + CTAs centered.
 */
export default function LandingDraft() {
  const navigate = useNavigate();

  // ─── Live data — drives the hero card stack ───
  // useEvents / useVenues / useCategories all share the React-Query cache
  // with the rest of the app, so navigating from `/` to `/events` doesn't
  // re-fetch. Falls back gracefully to empty arrays while loading.
  const { data: eventsData = [] } = useEvents();
  const { data: categoriesData = [] } = useCategories();
  // Warm the venues cache while the user reads the landing. The hero doesn't
  // render venues, but `/events` and `/map` both need them (venueMap, walking
  // distance, map pins) — fetching here means those tabs open with data in
  // cache instead of showing a spinner. Same `["venues"]` queryKey, so the
  // result is read directly. Result intentionally unused on this page.
  useVenues();
  const today = berlinDateString();
  const tomorrow = berlinDateStringOffset(1);

  // Late-night / next-day fallback: once today's pool empties, the page
  // pivots to tomorrow so the hero cluster + CTAs land somewhere with
  // events instead of advertising an empty Tonight tab. `mode` drives
  // both the carousel pool and the visible copy further down.
  const { pool, count, mode } = useMemo(() => {
    const todays = eventsData.filter(
      (e) =>
        e.date === today &&
        isEventStillOnline(e) &&
        e.status !== "canceled",
    );
    if (todays.length > 0)
      return { pool: todays, count: todays.length, mode: "tonight" as const };
    const tomorrows = eventsData.filter(
      (e) => e.date === tomorrow && e.status !== "canceled",
    );
    if (tomorrows.length > 0)
      return { pool: tomorrows, count: tomorrows.length, mode: "tomorrow" as const };
    return { pool: [] as BarlinEvent[], count: 0, mode: "empty" as const };
  }, [eventsData, today, tomorrow]);

  // Both landing CTAs (primary button + accent sticker) must land on the
  // tab whose events the hero is actually showing. Index's day filter lives
  // in sessionStorage, so a stale value from a previous visit would otherwise
  // override the CTA's promise.
  const goToEvents = () => {
    setFilter("activeDate", mode === "tomorrow" ? "Tomorrow" : "All");
    navigate("/events");
  };

  // Tap a hero preview card → land on /events with that card's tab selected,
  // and hand the event id to Index via router state so it scrolls the list
  // straight to (and briefly flags) the matching card.
  const goToEvent = (eventId: string) => {
    setFilter("activeDate", mode === "tomorrow" ? "Tomorrow" : "All");
    navigate("/events", { state: { scrollToEventId: eventId } });
  };

  // Hero card seed — stable across renders within a single visit, fresh
  // on each page load. Lets the landing show different events each visit
  // without re-shuffling on every re-render.
  const [shuffleSeed] = useState(() => Math.random());

  // Carousel pool — every event from the active day (tonight, or tomorrow when
  // tonight is empty), shuffled deterministically per visit. The hero stack
  // cycles through the whole pool, and the mobile card can be swiped through
  // all of it, so the counter ("X of N") reflects the real total.
  const heroPool = useMemo(() => {
    let seed = Math.floor(shuffleSeed * 1e9);
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const shuffled = [...pool].sort(() => rand() - 0.5);
    // First pass: one card per distinct venue, in shuffled order, so the start
    // of the loop never repeats a bar. Second pass: append everything still
    // left so the cycle covers the full day's events.
    const picks: BarlinEvent[] = [];
    const seenVenues = new Set<string>();
    for (const e of shuffled) {
      if (!seenVenues.has(e.venue)) {
        picks.push(e);
        seenVenues.add(e.venue);
      }
    }
    for (const e of shuffled) {
      if (!picks.includes(e)) picks.push(e);
    }
    return picks;
  }, [pool, shuffleSeed]);

  // Phones render a single crossfading card (the desktop drift deck is
  // hidden below lg), so it can step through the pool far more often than
  // the slow desktop drift. Tracked via matchMedia so resizing across the
  // lg breakpoint re-paces the timer.
  // Resolve synchronously on first render — initialising to false would make
  // the very first cycle effect run think it's desktop and fire the immediate
  // drift kick, so navigating onto the landing page on a phone swapped the
  // card instantly instead of after a full cycle.
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Carousel cycle — the stack advances one slot every CYCLE_MS. On desktop,
  // linear easing + a transition duration matching the interval keeps the
  // cards drifting at constant velocity with no perceptible "rest". On
  // mobile it's a quicker crossfade cadence. Skips when the pool is too small.
  const CYCLE_MS = isMobile ? 5000 : 28000;
  const [cycleIndex, setCycleIndex] = useState(0);
  // Bumped on a manual swipe to force the cycle effect to re-run (resetting
  // the timer) so a hand-advanced card still gets a full dwell before the
  // auto-cycle takes over again.
  const [manualNudge, setManualNudge] = useState(0);
  // Bumped when the desktop tab becomes visible again: remounts the card deck
  // so the cards snap cleanly to their slot poses instead of resuming the
  // half-frozen, possibly-jumbled drift animations. snapNextRef makes that one
  // remount skip the entrance drift (cards appear pre-placed at their slots).
  const [resyncSeq, setResyncSeq] = useState(0);
  const snapNextRef = useRef(false);
  // How much of the current cycle's wait is still pending, in ms. The timer
  // pauses *together with* the tab: while hidden, the browser also freezes
  // framer's rAF-driven animations, so the timer must NOT advance by wall-clock
  // time while away. The old code did exactly that — it anchored to
  // performance.now() and fired a "catch-up" tick on resume, which retargeted
  // every card while the animations were still frozen at their old phase. That
  // retarget-against-frozen-state is what collapsed the fanned stack into a
  // pile. Instead we snapshot the remaining time on hide and resume from
  // exactly there, keeping the timer and the animations in lockstep so the
  // drift simply continues where it left off. null = never started, so the
  // first start uses the initial cadence below.
  const remainingRef = useRef<number | null>(null);
  // Set by a manual swipe: tells the next start() to ignore whatever wait was
  // pending and begin a fresh full cycle instead of resuming mid-wait.
  const forceResetRef = useRef(false);
  // True while/just after a drag, so the trailing tap that a pointer-up emits
  // doesn't also open the event. Reset shortly after the drag ends.
  const draggedRef = useRef(false);
  // Direction of the last card change, for the swipe animation: +1 = next
  // (new card slides in from the right, old exits left), -1 = previous,
  // 0 = auto-cycle (plain crossfade, no horizontal slide).
  const [swipeDir, setSwipeDir] = useState(0);
  useEffect(() => {
    // Mobile no longer auto-cycles — the card only changes on a manual swipe.
    // Desktop keeps its slow continuous drift.
    if (heroPool.length < 2 || isMobile) return;
    let pendingTick: ReturnType<typeof setTimeout> | undefined;
    let interval: ReturnType<typeof setInterval> | undefined;
    // Wall-clock bookkeeping for the *currently pending* wait, so stop() can
    // work out how much of it is left and start() can resume from there.
    let waitStart = 0;
    let waitDuration = 0;
    // How long the deck stays snapped-but-static after the tab regains focus
    // before the drift resumes. Just enough for the resync remount to commit —
    // kept short so the on-return stall is barely perceptible (the snap itself
    // doesn't matter; standing still does).
    const RESUME_DELAY_MS = 150;
    const tick = () => {
      setSwipeDir(0); // auto-cycle crossfades; only manual swipes slide
      setCycleIndex((i) => i + 1);
      // Each interval tick restarts a full-cycle wait.
      waitStart = performance.now();
      waitDuration = CYCLE_MS;
      remainingRef.current = CYCLE_MS;
    };
    const start = (explicitDelay?: number) => {
      if (interval || pendingTick) return;
      // First ever start: desktop kicks on the next frame so the continuous
      // drift begins immediately; mobile holds the first card a full CYCLE_MS
      // so every card gets equal dwell. Later resumes continue from the time
      // that remained when the tab was hidden — no catch-up, no pile.
      // A manual swipe always restarts the dwell from scratch; otherwise the
      // first ever start uses the initial cadence and later resumes continue
      // from the time that remained when the tab was hidden.
      // An explicitDelay overrides all of that — used by the visibility resume
      // so the snapped deck starts drifting again after a short beat instead of
      // sitting frozen for a whole CYCLE_MS.
      const delay = explicitDelay != null
        ? explicitDelay
        : forceResetRef.current
        ? CYCLE_MS
        : remainingRef.current === null
          ? isMobile
            ? CYCLE_MS
            : 0
          : remainingRef.current;
      if (forceResetRef.current) {
        forceResetRef.current = false;
        remainingRef.current = CYCLE_MS;
      }
      waitStart = performance.now();
      waitDuration = delay;
      pendingTick = setTimeout(() => {
        pendingTick = undefined;
        tick();
        interval = setInterval(tick, CYCLE_MS);
      }, delay);
    };
    const stop = () => {
      // Snapshot how much of the pending wait is left so resume continues in
      // lockstep with the (also-paused) animations instead of catching up.
      if (pendingTick || interval) {
        remainingRef.current = Math.max(0, waitDuration - (performance.now() - waitStart));
      }
      if (pendingTick) clearTimeout(pendingTick);
      if (interval) clearInterval(interval);
      pendingTick = undefined;
      interval = undefined;
    };
    // Resume helper, shared by every "became active again" signal. It always
    // tears down whatever timer state exists — including a Safari-frozen
    // interval our JS still holds a (dead) handle to — and schedules a fresh
    // tick, so the drift is guaranteed to be moving again within
    // RESUME_DELAY_MS. Snapping the deck on the way back is fine; never standing
    // still is what matters.
    let lastReanchor = -Infinity;
    const reanchor = () => {
      // Coalesce the burst of events a single tab switch emits (Chrome fires
      // visibilitychange *and* focus) so we don't remount the deck twice — but
      // only while a timer is actually scheduled. If nothing is pending we may
      // be frozen, so always re-anchor regardless of how recent the last one was.
      const now = performance.now();
      if ((interval || pendingTick) && now - lastReanchor < 250) return;
      lastReanchor = now;
      snapNextRef.current = true;
      setResyncSeq((s) => s + 1);
      stop();
      start(RESUME_DELAY_MS);
    };
    const handleVisibility = () => {
      // Pause ONLY on a genuine hide. We deliberately do NOT pause on window
      // `blur`: blur also fires for an address-bar click or a transient focus
      // blip during a minimize→restore, and pausing there is exactly what left
      // the deck frozen indefinitely (no matching focus came to wake it).
      if (document.visibilityState === "visible") reanchor();
      else stop();
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibility);
    // Resume fallbacks. On a Safari tab/app switch — and on a Chrome window
    // minimize→restore — visibilitychange is unreliable, but window `focus` and
    // bfcache `pageshow` fire. Routing them through reanchor() guarantees the
    // drift restarts no matter which signal the browser actually delivers.
    window.addEventListener("focus", reanchor);
    window.addEventListener("pageshow", reanchor);
    // Watchdog — the final guarantee. Whatever the cause (a visibility/focus
    // event the browser never fired, a Safari-frozen rAF, a thawed-but-stale
    // timer), if the deck hasn't moved for a beat *while the page is visible*,
    // force a re-anchor. It observes the symptom (no motion) directly, so it
    // self-heals every freeze the event handlers above might miss. In normal
    // foreground operation the drift is continuous (~16px/s), so this never
    // fires; it only ever kicks a genuine stall.
    let lastSig: number | null = null;
    let stillFor = 0;
    const WATCH_STEP = 300;
    const STALL_LIMIT = 600; // > RESUME_DELAY_MS (150), so a normal resume isn't flagged
    const probe = () => {
      let sig = 0;
      for (const el of document.querySelectorAll<HTMLElement>("[data-hero-card]")) {
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        sig += m.m41 * 131 + m.m42 * 17;
      }
      return sig;
    };
    const watchdog = setInterval(() => {
      if (document.visibilityState !== "visible") { lastSig = null; stillFor = 0; return; }
      const sig = probe();
      if (lastSig !== null && Math.abs(sig - lastSig) < 0.5) {
        stillFor += WATCH_STEP;
        if (stillFor >= STALL_LIMIT) { stillFor = 0; reanchor(); }
      } else {
        stillFor = 0;
      }
      lastSig = sig;
    }, WATCH_STEP);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", reanchor);
      window.removeEventListener("pageshow", reanchor);
      clearInterval(watchdog);
      stop();
    };
  }, [heroPool.length, CYCLE_MS, isMobile, manualNudge]);

  // Manual hero navigation — swipe left advances to the next card, swipe right
  // steps back. Bumping manualNudge restarts the auto-cycle timer (via the
  // effect deps) so the hand-picked card gets a full dwell before auto-cycling.
  const advanceHero = (dir: 1 | -1) => {
    if (heroPool.length < 2) return;
    forceResetRef.current = true;
    setSwipeDir(dir);
    setCycleIndex((i) => i + dir);
    setManualNudge((n) => n + 1);
  };

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
      // (((…) % N) + N) % N keeps the index in range even after a backward
      // swipe pushes cycleIndex negative.
      event: heroPool[(((cycleIndex + offset) % N) + N) % N],
      role,
    }));
  }, [heroPool, cycleIndex]);

  // First-mount flag — tracks whether the AnimatePresence has rendered
  // a non-empty card set yet. Flipped via useEffect *after* the first
  // render where visibleCards has any entries; before that flip, all
  // initial cards get their slot pose as `initial`, so they appear
  // pre-placed at primary/secondary/tertiary with no entry animation.
  // After the flip, every newly-keyed card (one per cycle tick) gets
  // SLOT_TRANSFORMS.enter and drifts in from off-stage. Tracking the
  // first non-empty render (rather than the first React render) matters
  // because event data loads async: on the very first render the pool
  // is empty and no cards mount at all, so framer would otherwise treat
  // the eventual first batch as a mid-cycle entrance.
  const cardsHaveMountedRef = useRef(false);
  const hasVisibleCards = visibleCards.length > 0;
  useEffect(() => {
    if (hasVisibleCards) cardsHaveMountedRef.current = true;
  }, [hasVisibleCards]);

  // Clear the one-shot snap flag after the resync remount has committed, so
  // subsequent cycle ticks animate (drift in) normally again.
  useEffect(() => {
    snapNextRef.current = false;
  }, [resyncSeq]);

  // 1-based position of the front card within the pool, for the "X of N"
  // counter. Wraps with cycleIndex, including backward swipes (negative-safe).
  const heroPosition =
    heroPool.length > 0
      ? (((cycleIndex % heroPool.length) + heroPool.length) % heroPool.length) + 1
      : 0;

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-background text-foreground">
      {/* ─── HERO (fills remaining viewport) ─── */}
      {/* items-start on mobile pins the headline near the top of the
          viewport (the desktop card cluster is hidden there, so
          centering left a heavy empty band above the type); items-center
          restores the balanced cluster-and-copy composition at lg+. */}
      <section className="relative isolate flex flex-1 min-h-0 items-start overflow-hidden lg:items-center">
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

        <div className="container relative grid w-full grid-cols-1 items-center gap-8 pt-16 pb-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pt-6">
          {/* ── LEFT: copy ── */}
          <div>
            <motion.h1
              className="heading-display m-0 leading-[1.1]"
              style={{ fontSize: "clamp(36px, 5.6vw, 78px)" }}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.15 }}
            >
              WHAT'S ON{" "}
              <span
                className="heading-editorial italic lowercase text-accent"
                style={{ letterSpacing: "-0.01em" }}
              >
                tonight
              </span>
              <br />
              IN BERLIN BARS<span className="text-accent">?</span>
            </motion.h1>

            <motion.p
              className="font-body mt-7 max-w-[500px] text-[17px] leading-[1.5] text-foreground/70 text-balance md:mt-5"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              Live music, comedy, DJs, quiz nights and more — mapped across independent
              Berlin bars.
            </motion.p>

            <motion.div
              className="mt-8 flex flex-wrap items-center gap-3 md:mt-6"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.42 }}
            >
              <button
                type="button"
                onClick={goToEvents}
                className="group inline-flex h-12 items-center justify-center gap-2.5 border-2 border-foreground bg-foreground px-6 font-mono font-bold uppercase text-background transition-all hover:bg-background hover:text-foreground active:scale-[0.98]"
                style={{ fontSize: 12, letterSpacing: "0.14em" }}
              >
                <span>All events</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/map")}
                className="group inline-flex h-12 items-center justify-center gap-2.5 border-2 border-foreground bg-background px-6 font-mono font-bold uppercase text-foreground transition-all hover:bg-foreground hover:text-background active:scale-[0.98]"
                style={{ fontSize: 12, letterSpacing: "0.14em" }}
              >
                Open the map
              </button>
            </motion.div>

            {/* tertiary — store links. Hrefs are placeholders ("#") until
                the App Store and Google Play listings go live; both anchors
                stay clickable-looking so the row reads as real CTAs. */}
            {/* TODO: uncomment once App Store + Google Play listings are live
            <motion.div
              className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-foreground/65 md:mt-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.55 }}
            >
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="group inline-flex items-center gap-2 transition-colors hover:text-foreground"
              >
                <Apple className="h-[14px] w-[14px]" strokeWidth={2.2} />
                <span
                  className="font-mono uppercase"
                  style={{ fontSize: 11, letterSpacing: "0.14em" }}
                >
                  App Store
                </span>
                <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="group inline-flex items-center gap-2 transition-colors hover:text-foreground"
              >
                <Play className="h-[14px] w-[14px]" strokeWidth={2.2} fill="currentColor" />
                <span
                  className="font-mono uppercase"
                  style={{ fontSize: 11, letterSpacing: "0.14em" }}
                >
                  Google Play
                </span>
                <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            </motion.div>
            */}

            {/* ── Mobile-only preview card ──
                Single cycling event card that anchors the bottom half of
                the hero on phones — the desktop 3-card cluster is hidden
                below lg, so without this the composition reads top-heavy
                with a big empty zone above the footer. Same cycling pool
                and index as the desktop stack; crossfades per tick
                instead of drifting (small viewport, less room for drift).
                The slight tilt mirrors the desktop deck's offset feel. */}
            {/* Wrapper renders unconditionally and reserves its full
                height (meta row + card slot) so the footer never jumps
                when event data finishes loading. Only the inner content
                waits on `visibleCards[0]`; it fades in place. */}
            <div className="mt-10 mb-12 min-h-[232px] lg:hidden">
              {visibleCards[0] && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                <div
                  className="font-mono mb-2.5 flex items-baseline gap-2 uppercase text-foreground/55"
                  style={{ fontSize: 10, letterSpacing: "0.18em" }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {mode === "tonight" && (
                      <span className="relative inline-flex h-1.5 w-1.5">
                        <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-75" />
                        <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                      </span>
                    )}
                    {mode === "tomorrow" ? "Tomorrow" : "Tonight"}
                  </span>
                  <span className="text-foreground/25">·</span>
                  <span>{heroPosition} / {count}</span>
                </div>
                {/* Reservation slot — min-h is the *outer* container,
                    not the card. Each card renders at its natural
                    height (short title → short card, long title +
                    description → tall card — that variation is the
                    point), and the slot absorbs the difference so the
                    footer stays put when a taller card cycles in. */}
                <div className="min-h-[200px]">
                  <AnimatePresence mode="wait" initial={false} custom={swipeDir}>
                    <motion.div
                      key={visibleCards[0].event.id}
                      custom={swipeDir}
                      role="button"
                      tabIndex={0}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.5}
                      onDragStart={() => {
                        draggedRef.current = true;
                      }}
                      onDragEnd={(_, info) => {
                        // Dragged past the threshold → step a card in that
                        // direction; otherwise it springs back to center.
                        if (info.offset.x < -60) advanceHero(1); // drag left → next
                        else if (info.offset.x > 60) advanceHero(-1); // drag right → previous
                        // Keep the flag up until after the trailing tap fires.
                        window.setTimeout(() => {
                          draggedRef.current = false;
                        }, 60);
                      }}
                      // Ignore the tap that follows a drag so swiping never
                      // also opens the event.
                      onTap={() => {
                        if (draggedRef.current) return;
                        goToEvent(visibleCards[0].event.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          goToEvent(visibleCards[0].event.id);
                        }
                      }}
                      variants={HERO_SWIPE_VARIANTS}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={
                        swipeDir === 0
                          ? { duration: 0.9, ease: "easeInOut" }
                          : { duration: 0.22, ease: [0.4, 0, 0.2, 1] }
                      }
                      className="relative cursor-grab touch-pan-y border-2 border-foreground bg-background shadow-[8px_8px_0_0_#0f0f0f] active:cursor-grabbing"
                      style={{
                        padding: "20px 18px 16px",
                        transformOrigin: "left center",
                      }}
                    >
                      <HeroEventCard
                        event={visibleCards[0].event}
                        categories={categoriesData}
                        variant="primary"
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
              )}
            </div>
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
            <AnimatePresence key={resyncSeq} mode="popLayout" initial={false}>
              {visibleCards.map(({ event, role }) => {
                const slot = SLOT_TRANSFORMS[role];
                const slotPose = {
                  x: slot.x,
                  y: slot.y,
                  rotate: slot.rotate,
                  scale: slot.scale,
                  opacity: 1,
                };
                // Before the first non-empty render has committed, the
                // three starting cards skip their entry animation via
                // initial={false} (framer documented shorthand for "snap
                // to animate on mount"), so they appear pre-placed at
                // primary / secondary / tertiary. Every later mount (new
                // tertiary on each cycle tick) uses SLOT_TRANSFORMS.enter
                // so it visibly drifts in from off-stage. Framer only
                // reads `initial` on mount; recomputing it on
                // already-mounted cards is a no-op.
                // On a resync remount (snapNextRef) every card appears
                // pre-placed at its slot (initial=false) so nothing drifts in;
                // otherwise a newly-mounted card drifts in from the enter pose.
                const initialPose =
                  cardsHaveMountedRef.current && !snapNextRef.current
                    ? SLOT_TRANSFORMS.enter
                    : false;
                return (
                  <motion.div
                    key={event.id}
                    data-hero-card=""
                    role="button"
                    tabIndex={0}
                    onClick={() => goToEvent(event.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        goToEvent(event.id);
                      }
                    }}
                    initial={initialPose}
                    animate={slotPose}
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
                    className="absolute left-0 top-0 w-[360px] cursor-pointer border-2 border-foreground bg-background shadow-[12px_12px_0_0_#0f0f0f]"
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

            {/* Live-count sticker — stays put while cards cycle around it.
                Reads as a CTA (accent slab, bold, shadow), so it acts like
                one: click → /, same destination as the "Events tonight"
                secondary button. */}
            {count > 0 && (
              <button
                type="button"
                onClick={goToEvents}
                className="group absolute bottom-[1%] right-[3%] rotate-[8deg] border-2 border-foreground bg-accent px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-accent-foreground shadow-[6px_6px_0_0_#0f0f0f] transition-all hover:-translate-y-0.5 hover:translate-x-0.5 hover:rotate-[8deg] hover:shadow-[4px_4px_0_0_#0f0f0f] active:translate-x-1 active:translate-y-1 active:rotate-[8deg] active:shadow-[2px_2px_0_0_#0f0f0f]"
                style={{ zIndex: 10 }}
              >
                {count} {mode === "tomorrow" ? "tomorrow" : "tonight"}
              </button>
            )}
          </motion.div>
        </div>
      </section>

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
/* Mobile card swipe variants — `custom` carries the swipe direction.
 * dir > 0 (next): new card enters from the right, old exits left.
 * dir < 0 (previous): mirrored. dir === 0 (auto-cycle): pure crossfade,
 * no horizontal travel. */
const HERO_SWIPE_VARIANTS = {
  enter: (dir: number) => ({ x: dir > 0 ? 90 : dir < 0 ? -90 : 0, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({
    x: dir > 0 ? -90 : dir < 0 ? 90 : 0,
    opacity: 0,
    // Carry the timing here (not the component's `transition` prop, which the
    // exiting card freezes at its last render) so the outgoing card uses the
    // CURRENT swipe direction — otherwise the first swipe after an auto-cycle
    // exits with the slow 0.9s crossfade.
    transition:
      dir === 0
        ? { duration: 0.9, ease: "easeInOut" }
        : { duration: 0.22, ease: [0.4, 0, 0.2, 1] },
  }),
};

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
