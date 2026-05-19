import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, Mail, MessageSquareText, Sparkles, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const topics = [
  { id: "instagram", label: "Help run Instagram / TikTok",  subject: "Instagram / TikTok collab" },
  { id: "host",      label: "Host an event",       subject: "Host an event" },
  { id: "collab",    label: "Want to collaborate", subject: "Collaboration" },
  { id: "bug",       label: "Report a bug",        subject: "Bug report" },
  { id: "press",     label: "Press / Media",       subject: "Press inquiry" },
  { id: "feedback",  label: "General feedback",    subject: "Feedback" },
  { id: "other",     label: "Other",               subject: "Other" },
] as const;

type TopicId = (typeof topics)[number]["id"];
type SubmitState = "idle" | "sending" | "sent" | "error";

const EMAIL = "hello@insidebars.co";

export default function Contact() {
  const [topicId, setTopicId] = useState<TopicId | "">("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  // Honeypot — real users never see or fill this. Bots scraping the
  // form will fill every field; if hp is set the edge function silently
  // 200s without sending.
  const [hp, setHp] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const canSubmit =
    topicId !== "" &&
    email.trim().length > 0 &&
    message.trim().length > 0 &&
    submitState !== "sending";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitState("sending");
    setErrorMsg("");
    try {
      const { data, error } = await supabase.functions.invoke(
        "send-contact-message",
        {
          body: {
            name: name.trim(),
            email: email.trim(),
            message: message.trim(),
            topic: topicId,
            hp,
          },
        },
      );
      if (error) throw new Error(error.message);
      if (data && typeof data === "object" && "error" in data) {
        throw new Error(String((data as { error?: string }).error ?? "Send failed"));
      }
      setSubmitState("sent");
      setName("");
      setEmail("");
      setMessage("");
      setHp("");
      setTopicId("");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Couldn't send right now. Try again?",
      );
      setSubmitState("error");
    }
  }

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
            style={{ fontSize: "clamp(36px, 5.6vw, 78px)" }}
          >
            Let's{" "}
            <span className="heading-editorial italic lowercase font-light tracking-tight">
              connect
            </span>
            <span className="text-accent">.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-6 max-w-xl text-balance text-lg leading-[1.5] text-foreground/75 md:text-xl"
          >
            We're always looking to collaborate — with new bars,
            partners, and people who love Berlin's small venues as
            much as we do.
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

          {/* ── LEFT — intent (collab CTA → chips → email) ──
              md:pt-2 nudges the eyebrow down so it sits on the same
              baseline as the right column's "What's this about?" label. */}
          <div className="md:pr-10 lg:pr-14 md:pt-2">
            <div className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">
              Reach out if you want to
            </div>

            {/* Top-priority ask — Inside Bars is actively looking for
                someone to run our Instagram. Seeds the "What's this
                about?" select and scrolls the form into view so the
                user lands in the right intake context instead of being
                shipped off to a separate page. */}
            <button
              type="button"
              onClick={() => setTopicId("instagram")}
              className="group flex w-full items-start gap-3 border-2 border-foreground bg-card p-5 text-left shadow-[8px_8px_0_0_#0f0f0f] transition-all hover:bg-foreground hover:text-background hover:shadow-[6px_6px_0_0_hsl(var(--accent))]"
            >
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent group-hover:text-background" />
              <div className="flex-1">
                <p className="font-serif text-lg font-semibold leading-tight">
                  Help us run our Instagram / TikTok{" "}
                  <span aria-hidden className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
                </p>
              </div>
            </button>

            <ul className="mt-10 flex flex-wrap gap-2">
              {topics.filter((t) => t.id !== "instagram").map((t) => {
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
                Plain bordered block (no hard shadow) so it sits
                visually below the top collab CTA in the hierarchy.
                Icon-left layout mirrors the IG + bar-owner cards. */}
            <div className="mt-16 flex items-start gap-3 border-2 border-foreground bg-background p-5">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <div className="flex-1">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">
                  Email us directly
                </div>
                <a
                  href={`mailto:${EMAIL}`}
                  className="heading-display mt-1 block text-lg leading-tight transition-colors hover:text-accent"
                >
                  {EMAIL}
                </a>
              </div>
            </div>

            {/* Bar-owner CTA — funnels venue claims to /for-bars so
                they don't get lost in the generic form. Plain bordered
                block (no shadow) so the IG ask stays the page's
                top-priority visual. */}
            <Link
              to="/for-bars"
              className="group mt-4 flex w-full items-start gap-3 border-2 border-foreground bg-background p-5 text-left transition-colors hover:bg-foreground hover:text-background"
            >
              <Store className="mt-0.5 h-4 w-4 shrink-0 text-accent group-hover:text-background" />
              <div className="flex-1">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55 group-hover:text-background/70">
                  Run a bar in Berlin?
                </div>
                <p className="mt-1 font-serif text-lg font-semibold leading-tight">
                  List your bar and publish events{" "}
                  <span aria-hidden className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
                </p>
              </div>
            </Link>
          </div>

          {/* ── RIGHT — form ── */}
          <div className="md:pl-10 lg:pl-14">
            {submitState === "sent" ? (
              <div className="flex h-full flex-col items-start justify-center border-2 border-foreground bg-card p-8 shadow-[8px_8px_0_0_#0f0f0f]">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center border-2 border-foreground bg-accent text-background">
                  <Check className="h-5 w-5" strokeWidth={3} />
                </div>
                <h3 className="heading-display text-3xl leading-tight">
                  Message{" "}
                  <span className="heading-editorial italic lowercase font-light">
                    sent
                  </span>
                  <span className="text-accent">.</span>
                </h3>
                <p className="mt-4 max-w-md text-[15px] leading-[1.6] text-foreground/75">
                  Thanks for reaching out — we'll come back to you within a
                  few days at the email address you gave us.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitState("idle")}
                  className="mt-6 inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/55 hover:text-foreground transition-colors"
                >
                  Send another <span aria-hidden="true">→</span>
                </button>
              </div>
            ) : (
            <form
              onSubmit={handleSubmit}
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
                  onChange={(e) => setTopicId(e.target.value as TopicId | "")}
                  className={`h-11 w-full border-2 border-foreground bg-background px-3 font-serif text-base outline-none transition-colors focus:bg-card ${
                    topicId === "" ? "text-foreground/45" : "text-foreground"
                  }`}
                >
                  <option value="" disabled>
                    Select a topic
                  </option>
                  {topics.filter((t) => t.id !== "instagram").map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                  {topicId === "instagram" && (
                    <option value="instagram">Help run Instagram / TikTok</option>
                  )}
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
                  Email
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

              {/* Honeypot — kept visually hidden + out of tab/AT order.
                  Bots autofill every input; real users never see this. */}
              <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden opacity-0" style={{ left: "-9999px" }}>
                <label>
                  Don't fill this in
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={hp}
                    onChange={(e) => setHp(e.target.value)}
                  />
                </label>
              </div>

              {submitState === "error" && errorMsg && (
                <div
                  role="alert"
                  className="border-2 border-foreground bg-background px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-foreground"
                >
                  <span className="text-accent">Error · </span>
                  <span className="font-sans normal-case tracking-normal text-[13px] font-normal text-foreground/80">
                    {errorMsg}
                  </span>
                </div>
              )}

              {/* Send — real submit button, hits the send-contact-message
                  edge function. Disabled while sending or while required
                  fields are empty. */}
              <button
                type="submit"
                disabled={!canSubmit}
                className="group mt-2 inline-flex h-12 w-full items-center justify-center gap-2 border-2 border-foreground bg-foreground px-6 font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-background transition-all hover:bg-background hover:text-foreground active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-foreground disabled:hover:text-background"
              >
                <MessageSquareText className="h-4 w-4" />
                {submitState === "sending" ? "Sending…" : "Send message"}
                {submitState !== "sending" && (
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                )}
              </button>

              <p className="pt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/45">
                Sent straight to our inbox &nbsp;·&nbsp; we reply within a few days
              </p>
            </form>
            )}
          </div>
        </div>
      </section>

    </div>
  );
}
