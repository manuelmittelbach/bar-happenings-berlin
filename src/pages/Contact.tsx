import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Mail, MessageSquareText, Sparkles } from "lucide-react";

const topics = [
  { id: "tip",      label: "Submit a tip",     subject: "Event tip" },
  { id: "claim",    label: "Claim your bar",   subject: "Claim my bar" },
  { id: "press",    label: "Press / Media",    subject: "Press inquiry" },
  { id: "bug",      label: "Report a bug",     subject: "Bug report" },
  { id: "feedback", label: "General feedback", subject: "Feedback" },
  { id: "hi",       label: "Just say hi",      subject: "Hi" },
] as const;

type TopicId = (typeof topics)[number]["id"];

const EMAIL = "hello@insidebars.co";

export default function Contact() {
  const [topicId, setTopicId] = useState<TopicId>("tip");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const activeTopic = useMemo(
    () => topics.find((t) => t.id === topicId) ?? topics[0],
    [topicId],
  );

  // Build a mailto: URL with subject + body pre-filled from form state.
  // No backend wiring needed — opens the user's mail client with the
  // payload ready to send. The page is still useful as a structured
  // intake even if the user has no mail-client configured (the form
  // fields collect the same info they'd otherwise have to remember).
  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent(`[Inside Bars] ${activeTopic.subject}`);
    const body = encodeURIComponent(
      [
        message ? message : "",
        "",
        "—",
        name ? `From: ${name}` : "",
        email ? `Reply-to: ${email}` : "",
        `Topic: ${activeTopic.label}`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    return `mailto:${EMAIL}?subject=${subject}&body=${body}`;
  }, [activeTopic, name, email, message]);

  return (
    <div className="flex flex-1 flex-col bg-background">
      {/* ─── 1 · HERO ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b-2 border-foreground">
        {/* Faint dotted-grid wash, masked from the top-left so the
            hero corner has texture and the headline reads against
            calm cream. Same trick used on About + Landing. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "radial-gradient(ellipse at 22% 40%, black 22%, transparent 78%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at 22% 40%, black 22%, transparent 78%)",
          }}
        />

        <div className="container relative px-4 py-14 md:py-20">
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="heading-display leading-[0.95]"
            style={{ fontSize: "clamp(40px, 7.2vw, 84px)" }}
          >
            Let's{" "}
            <span className="heading-editorial italic lowercase font-light tracking-tight">
              talk
            </span>
            <span className="text-accent">.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-6 max-w-xl text-balance text-lg leading-[1.5] text-foreground/75 md:text-xl"
          >
            Questions, tips, ideas, or just a hello — we read everything
            and reply to most of it.
          </motion.p>
        </div>
      </section>

      {/* ─── 2 · MAIN GRID — left intent · right form ──────────── */}
      <section className="border-b-2 border-foreground">
        <div className="container relative grid grid-cols-1 gap-12 px-4 py-16 md:grid-cols-[0.95fr_1.05fr] md:gap-0 md:py-20">
          {/* Vertical 2px rule between intent + form on md+. Same
              treatment ForBars / About use. */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-12 bottom-12 hidden w-[2px] -translate-x-1/2 bg-foreground md:block"
          />

          {/* ── LEFT — intent (chips + email + collab) ── */}
          <div className="md:pr-10 lg:pr-14">
            <div className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">
              Reach out if you want to
            </div>

            <ul className="flex flex-wrap gap-2">
              {topics.map((t) => {
                const active = t.id === topicId;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setTopicId(t.id)}
                      className={`inline-flex items-center gap-1.5 border-2 border-foreground px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
                        active
                          ? "bg-foreground text-background"
                          : "bg-background text-foreground hover:bg-foreground hover:text-background"
                      }`}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="inline-block h-1.5 w-1.5 rounded-full bg-accent"
                        />
                      )}
                      {t.label}
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Email card — the brand-canon "I prefer email" path.
                Sharp 2px border, 8px hard shadow. Matches the About
                page Reach-Out card so the two pages read as a set. */}
            <div className="mt-10 border-2 border-foreground bg-card p-5 shadow-[8px_8px_0_0_#0f0f0f]">
              <div className="mb-2 flex items-baseline gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">
                <Mail className="h-3 w-3" />
                Email us directly
              </div>
              <a
                href={`mailto:${EMAIL}`}
                className="heading-display block text-2xl leading-tight transition-colors hover:text-accent"
              >
                {EMAIL}
              </a>
              <p className="mt-2 text-[13px] leading-[1.5] text-foreground/65">
                Prefer plain email? Skip the form — we read every message.
              </p>
            </div>

            {/* Looking for collaborators — sub-card. Inside Bars is
                still looking for someone to run social, so we surface
                that here instead of pretending we have an Instagram
                handle to follow. Links to the /instagram pitch page. */}
            <Link
              to="/instagram"
              className="group mt-4 flex items-start gap-3 border-2 border-foreground bg-background p-5 transition-all hover:bg-foreground hover:text-background"
            >
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent group-hover:text-background" />
              <div className="flex-1">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55 group-hover:text-background/70">
                  Photographers, writers, regulars
                </div>
                <p className="mt-1 font-serif text-base font-semibold">
                  Help us run our Instagram{" "}
                  <span aria-hidden className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
                </p>
              </div>
            </Link>
          </div>

          {/* ── RIGHT — form ── */}
          <div className="md:pl-10 lg:pl-14">
            <form
              onSubmit={(e) => {
                // Prevent the default form GET — we don't have a backend.
                // The Send button uses an <a href={mailtoHref}> so the
                // mail client opens with the body pre-filled. This
                // submit-handler is just a safety net for Enter-key
                // submissions while the user is typing.
                e.preventDefault();
                window.location.href = mailtoHref;
              }}
              className="space-y-5"
            >
              {/* Subject — mirrors the active chip. Editable so power
                  users can type a custom subject; topic chips just
                  seed the value. */}
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">
                  What's this about?
                </label>
                <select
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value as TopicId)}
                  className="h-11 w-full border-2 border-foreground bg-background px-3 font-serif text-base text-foreground outline-none transition-colors focus:bg-card"
                >
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">
                  Your name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="(optional)"
                  className="h-11 w-full border-2 border-foreground bg-background px-3 font-serif text-base text-foreground placeholder:text-foreground/30 outline-none transition-colors focus:bg-card"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11 w-full border-2 border-foreground bg-background px-3 font-serif text-base text-foreground placeholder:text-foreground/30 outline-none transition-colors focus:bg-card"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  placeholder={`Tell us what's on your mind…`}
                  className="w-full border-2 border-foreground bg-background px-3 py-2.5 font-serif text-base text-foreground placeholder:text-foreground/30 outline-none transition-colors focus:bg-card resize-none"
                />
              </div>

              {/* Send — anchor styled as a brutalist primary button.
                  Using <a href={mailtoHref}> lets browsers open the
                  mail client natively (no JS-trigger popups blocked).
                  active:scale tightens the press for tactility. */}
              <a
                href={mailtoHref}
                className="group mt-2 inline-flex h-12 w-full items-center justify-center gap-2 border-2 border-foreground bg-foreground px-6 font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-background transition-all hover:bg-background hover:text-foreground active:scale-[0.98]"
              >
                <MessageSquareText className="h-4 w-4" />
                Send message
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>

              <p className="pt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/45">
                Opens your mail client &nbsp;·&nbsp; we reply within a few days
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* ─── 3 · BAR-OWNER CTA — funnels venue claims out of the
          form and into the dedicated /for-bars onboarding so they
          don't get lost in the general inbox. ──────────────────── */}
      <section className="bg-muted/30">
        <div className="container px-4 py-12 md:py-16">
          <div className="flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between md:gap-8">
            <div>
              <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">
                Run a bar in Berlin?
              </div>
              <p className="heading-display text-2xl leading-tight md:text-3xl">
                Skip the form —{" "}
                <span className="heading-editorial italic lowercase font-light">
                  list your bar
                </span>{" "}
                in 2 minutes
                <span className="text-accent">.</span>
              </p>
            </div>
            <Link
              to="/for-bars"
              className="group inline-flex h-12 shrink-0 items-center gap-2 border-2 border-foreground bg-background px-6 font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-foreground transition-all hover:bg-foreground hover:text-background"
            >
              Get started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
