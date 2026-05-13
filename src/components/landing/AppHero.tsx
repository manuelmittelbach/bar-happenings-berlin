import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, MapPin } from "lucide-react";

type Props = {
  animate?: boolean;
};

export default function AppHero({ animate = true }: Props) {
  const navigate = useNavigate();

  const handlePrimary = () => {
    const el = document.getElementById("date-filter-bar");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section
      className="relative isolate overflow-hidden bg-background text-foreground"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 1rem)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute -bottom-40 right-[-22%] h-[600px] w-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(circle at center, hsla(18, 85%, 52%, 0.22), hsla(18, 85%, 52%, 0) 60%)",
            filter: "blur(20px)",
          }}
        />
        <div
          className="absolute -top-32 left-[-15%] h-[420px] w-[420px] rounded-full"
          style={{
            background:
              "radial-gradient(circle at center, hsla(18, 85%, 52%, 0.10), hsla(18, 85%, 52%, 0) 60%)",
            filter: "blur(20px)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "radial-gradient(ellipse at center, black 25%, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at center, black 25%, transparent 80%)",
          }}
        />
        <div className="absolute right-6 top-6 hidden h-px w-40 origin-right -rotate-[18deg] bg-foreground/20 md:block" />
        <div className="absolute right-6 top-9 hidden h-px w-24 origin-right -rotate-[18deg] bg-foreground/10 md:block" />
      </div>

      <div className="container relative z-10 flex min-h-[78svh] flex-col justify-center py-12 md:min-h-[600px] md:py-20">
        <motion.div
          initial={animate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-7 inline-flex items-center gap-2 self-start rounded-full border border-accent/30 bg-accent/[0.07] px-3 py-1.5 backdrop-blur-sm"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <span
            className="font-mono uppercase text-accent"
            style={{ fontSize: 11, letterSpacing: "0.14em" }}
          >
            Berlin · live tonight
          </span>
        </motion.div>

        <h1
          className="font-heading font-extrabold leading-[0.92] tracking-tight m-0"
          style={{ fontSize: "clamp(2.5rem, 9vw, 5rem)" }}
        >
          <span className="block overflow-hidden pb-[0.05em]">
            <motion.span
              initial={animate ? { opacity: 0, y: 28 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block"
            >
              What's on{" "}
              <span
                className="heading-editorial lowercase italic font-normal"
                style={{ letterSpacing: "-0.01em" }}
              >
                tonight
              </span>
            </motion.span>
          </span>
          <span className="block overflow-hidden pb-[0.05em]">
            <motion.span
              initial={animate ? { opacity: 0, y: 28 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block"
            >
              in Berlin bars
              <span className="text-accent">?</span>
            </motion.span>
          </span>
        </h1>

        <motion.p
          initial={animate ? { opacity: 0, y: 12 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.48 }}
          className="mt-7 max-w-[480px] font-body text-[15px] leading-[1.55] text-foreground/70 md:text-[17px]"
          style={{ textWrap: "balance" }}
        >
          All the small, independent, slightly chaotic things happening in
          bars tonight.
        </motion.p>

        <motion.div
          initial={animate ? { opacity: 0, y: 12 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.62 }}
          className="mt-9 flex flex-col gap-3 sm:flex-row sm:gap-3"
        >
          <button
            onClick={handlePrimary}
            className="group inline-flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-foreground bg-foreground px-7 font-mono uppercase text-background shadow-[0_10px_30px_-12px_hsla(18,85%,52%,0.5)] transition-all hover:bg-background hover:text-foreground active:scale-[0.98]"
            style={{ fontSize: 12, letterSpacing: "0.12em" }}
          >
            <span>See tonight's events</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <button
            onClick={() => navigate("/map")}
            className="group inline-flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-foreground bg-transparent px-7 font-mono uppercase text-foreground transition-all hover:bg-foreground hover:text-background active:scale-[0.98]"
            style={{ fontSize: 12, letterSpacing: "0.12em" }}
          >
            <MapPin className="h-4 w-4" />
            <span>Open the map</span>
          </button>
        </motion.div>

        <motion.div
          initial={animate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.85 }}
          className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono uppercase text-foreground/45"
          style={{ fontSize: 10, letterSpacing: "0.18em" }}
        >
          <span>Independent only</span>
          <span className="h-px w-6 bg-foreground/20" />
          <span>Updated daily</span>
          <span className="hidden h-px w-6 bg-foreground/20 sm:block" />
          <span className="hidden sm:inline">No login required</span>
        </motion.div>
      </div>
    </section>
  );
}
