import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

type Props = {
  animate?: boolean;
};

export default function AppHero({ animate = true }: Props) {
  const navigate = useNavigate();

  return (
    <section className="relative isolate overflow-hidden bg-background text-foreground pt-11 pb-8">
      {/* Background — grid pattern faded out with a radial mask so the
          hero-bottom meets the sticky bar below as plain cream. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "radial-gradient(ellipse at 50% 42%, black 22%, transparent 90%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at 50% 42%, black 22%, transparent 90%)",
          }}
        />
      </div>

      <div className="container relative z-[45]">
        <motion.div
          initial={animate ? { opacity: 0, y: 12 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="mb-[18px] inline-flex items-center gap-2 self-start"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <span
            className="font-mono uppercase text-accent"
            style={{ fontSize: 11, letterSpacing: "0.14em" }}
          >
            Berlin · live now
          </span>
        </motion.div>

        <motion.h1
          className="heading-display leading-[0.95] m-0"
          style={{ fontSize: "clamp(36px, 5.5vw, 72px)" }}
          initial={animate ? { opacity: 0, y: 12 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          What's on{" "}
          <span
            className="heading-editorial lowercase italic"
            style={{ letterSpacing: "-0.01em" }}
          >
            tonight
          </span>
          <br />in Berlin bars
          <span className="text-accent" style={{ fontStyle: "normal" }}>?</span>
        </motion.h1>

        <motion.p
          className="font-body max-w-[580px] text-[15px] md:text-[18px] text-foreground/70"
          style={{
            lineHeight: 1.55,
            marginTop: 22,
            marginBottom: 0,
            textWrap: "balance",
          }}
          initial={animate ? { opacity: 0, y: 12 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          All the small, sometimes slightly chaotic things happening in bars tonight.
        </motion.p>

        <motion.div
          style={{ marginTop: 28 }}
          initial={animate ? { opacity: 0, y: 12 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <button
            type="button"
            onClick={() => navigate("/map")}
            className="group inline-flex h-14 items-center justify-center gap-2.5 border-2 border-foreground bg-foreground px-7 font-mono uppercase text-background transition-all hover:bg-background hover:text-foreground active:scale-[0.98]"
            style={{ fontSize: 12, letterSpacing: "0.14em" }}
          >
            <span>Open the map</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </motion.div>
      </div>
    </section>
  );
}
