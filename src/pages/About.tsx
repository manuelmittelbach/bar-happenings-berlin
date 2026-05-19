import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, MessageSquareText } from "lucide-react";

const beliefs = [
  {
    num: "01",
    head: "Small bars",
    tail: (
      <>
        are the cultural <em className="heading-editorial italic">backbone</em> of Berlin.
      </>
    ),
  },
  {
    num: "02",
    head: "Under 50 people",
    tail: <>is where the best nights happen.</>,
  },
  {
    num: "03",
    head: "This site",
    tail: (
      <>
        exists to get you <em className="heading-editorial italic">off it</em>. Find a bar, then go.
      </>
    ),
  },
  {
    num: "04",
    head: "Independent venues",
    tail: <>deserve visibility tools that don't bury them under corporate listings.</>,
  },
] as const;

export default function About() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      {/* ─── 1 · HERO ─────────────────────────────────────────────
          Editorial title block with mono eyebrow + accent-orange
          punctuation, mirroring the LandingDraft hero voice. A
          rotated stamp anchors the top-right corner so the band
          reads as a magazine cover rather than a flat doc page. */}
      <section className="relative overflow-hidden border-b-2 border-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "radial-gradient(ellipse at 28% 60%, black 25%, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at 28% 60%, black 25%, transparent 80%)",
          }}
        />

        <div className="container relative px-4 py-16 md:py-24">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="heading-display leading-[0.95]"
              style={{ fontSize: "clamp(36px, 5.6vw, 78px)" }}
            >
              ABOUT{" "}
              <span className="heading-editorial italic lowercase font-light tracking-tight">
                inside
              </span>
              <br />
              BARS<span className="text-accent">.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="mt-8 max-w-xl text-balance text-lg leading-[1.5] text-foreground/75 md:text-xl"
            >
              A simple idea — make it easy to find out what's happening
              tonight in Berlin's small, independent bars.
            </motion.p>
          </div>

        </div>
      </section>

      {/* ─── 2 · PROBLEM / FIX — two-column editorial spread ──────
          Mirrors the ForBars split (2px vertical rule, mono eyebrow
          per column) and the Gay Map "Vision / Mission" pairing,
          but here the columns name the actual narrative beats —
          what's broken, and what Inside Bars does about it. */}
      <section className="relative border-b-2 border-foreground">
        <div className="container relative grid grid-cols-1 gap-12 px-4 py-16 md:grid-cols-2 md:gap-0 md:py-24">
          {/* Vertical 2px rule between columns — only on md+. Same
              treatment ForBars uses. */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-12 bottom-12 hidden w-[2px] -translate-x-1/2 bg-foreground md:block"
          />

          <article className="md:pr-10 lg:pr-16">
            <div className="mb-4 flex items-baseline gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">
              <span className="text-accent">01</span>
              The Problem
            </div>
            <h2 className="heading-display text-3xl leading-[1.05] md:text-4xl">
              The best nights are{" "}
              <span className="heading-editorial italic lowercase font-light">
                invisible
              </span>
              <span className="text-accent">.</span>
            </h2>
            <p className="mt-5 text-[15px] leading-[1.65] text-foreground/75 md:text-base">
              Berlin's bar scene is one of the most vibrant in the world.
              Every night, dozens of venues host live music, open mics,
              comedy nights, DJ sets, and other small happenings. But most
              of these events are buried in Instagram stories, passed by
              word of mouth, or scrawled on a chalkboard outside the door.
            </p>
          </article>

          <article className="md:pl-10 lg:pl-16">
            <div className="mb-4 flex items-baseline gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">
              <span className="text-accent">02</span>
              The Fix
            </div>
            <h2 className="heading-display text-3xl leading-[1.05] md:text-4xl">
              Local{" "}
              <span className="heading-editorial italic lowercase font-light">
                and
              </span>{" "}
              curated<span className="text-accent">.</span>
            </h2>
            <p className="mt-5 text-[15px] leading-[1.65] text-foreground/75 md:text-base">
              We built Inside Bars to surface the small stuff — not another generic event marketplace, but a platform that feels local, curated, and true to the
              spirit of Berlin's independent bar culture. One map. Tonight,
              tomorrow, and whatever's coming up. Made for going out, not
              scrolling.
            </p>
          </article>
        </div>
      </section>

      {/* ─── 3 · MANIFESTO — five numbered beliefs ───────────────
          Equivalent of the Gay Map "Core Values" triplet, expanded
          to 5 to match the existing copy. Uses the ForBars benefits
          pattern (`border-t` + mono `01` in accent), but with
          serif body text per item so each line reads as a beat in
          a manifesto rather than a feature bullet. */}
      <section className="bg-muted/40 border-b-2 border-foreground">
        <div className="container px-4 py-16 md:py-24">
          <div className="mb-12 md:mb-16">
            <h2 className="heading-display text-3xl leading-[1.05] md:text-5xl">
              What we{" "}
              <span className="heading-editorial italic lowercase font-light">
                believe
              </span>
              <span className="text-accent">.</span>
            </h2>
          </div>

          <ul className="grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2">
            {beliefs.map((b, i) => (
              <motion.li
                key={b.num}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: i * 0.05 }}
                className="flex flex-col gap-2 border-t-2 border-foreground pt-4"
              >
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-accent">
                  {b.num}
                </span>
                <h3 className="font-serif text-xl font-semibold leading-tight">
                  {b.head}
                </h3>
                <p className="text-[15px] leading-[1.55] text-foreground/70">
                  {b.tail}
                </p>
              </motion.li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── 4 · WHO'S BEHIND THIS ───────────────────────────────
          Pull-quote on the left, contact card on the right. The
          left column carries the human voice ("Built by regulars")
          and the right column is a hard-bordered cream block with
          the email + "list your bar" actions — same brutalist
          card treatment used for the LandingDraft hero cards. */}
      <section className="border-b-2 border-foreground">
        <div className="container grid grid-cols-1 gap-12 px-4 py-16 md:grid-cols-[1.2fr_0.8fr] md:gap-16 md:py-24">
          <div>
            <div className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">
              Who's behind this
            </div>
            <p className="heading-display text-3xl leading-[1.1] md:text-5xl">
              Built{" "}
              <span className="heading-editorial italic lowercase font-light">
                by
              </span>{" "}
              regulars
              <span className="text-accent">.</span>
            </p>
            <p className="mt-7 max-w-xl text-[15px] leading-[1.65] text-foreground/75 md:text-base">
              Inside Bars is an independent project — small team, no
              investors, no algorithm. We're regulars at the kind of bars we
              built this platform for. We think they deserve more
              visibility, and we think the people looking for a good
              Tuesday night deserve a better tool to find them.
            </p>
          </div>

          {/* Contact card — sharp 2px border, hard offset shadow.
              The shadow direction matches the LandingDraft hero
              cards (8px / 8px) so the page reads as one coherent
              brutalist object collection. */}
          <aside className="relative">
            <div className="relative border-2 border-foreground bg-card p-6 shadow-[8px_8px_0_0_#0f0f0f] md:p-7">
              <div className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">
                Reach out
              </div>

              <h3 className="heading-display text-2xl leading-tight">
                Questions, ideas,
                <br />
                <span className="heading-editorial italic lowercase font-light">
                  or a tip
                </span>
                <span className="text-accent">?</span>
              </h3>

              <Link
                to="/contact"
                className="group mt-5 inline-flex items-center gap-2 border-2 border-foreground bg-foreground px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-background transition-all hover:bg-background hover:text-foreground"
              >
                <MessageSquareText className="h-3.5 w-3.5" />
                Get in contact
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {/* ─── 5 · MAP DATA — fine print band ──────────────────────
          OSM attribution lives in its own band rather than as a
          stub at the bottom of a prose column. Mono uppercase to
          match the rest of the site's metadata language. */}
      <section className="bg-muted/30">
        <div className="container px-4 py-10 md:py-14">
          <div className="flex flex-col gap-3 md:flex-row md:items-baseline md:justify-between md:gap-8">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">
              Map data &amp; credits
            </div>
            <p className="max-w-3xl text-xs leading-relaxed text-foreground/60 md:text-right">
              Map tiles by{" "}
              <a
                href="https://openfreemap.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-2 hover:text-accent transition-colors"
              >
                OpenFreeMap
              </a>{" "}
              ©{" "}
              <a
                href="https://openmaptiles.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-2 hover:text-accent transition-colors"
              >
                OpenMapTiles
              </a>
              . Map data from{" "}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-2 hover:text-accent transition-colors"
              >
                OpenStreetMap
              </a>{" "}
              contributors. Type set in Georgia, DM Sans, and Space Mono.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
