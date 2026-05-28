import { Link } from "react-router-dom";

/* Info — about page for the native app, reached via the top-right
 * info icon. Houses the things that have no other home on native: a
 * short pitch, legal links (Impressum, Datenschutz), and a pointer to
 * the web for bar owners who want to publish or manage their account.
 * Web users land here only if they navigate directly — the web Footer
 * already carries Impressum/Datenschutz. */
export default function Info() {
  return (
    <div className="flex-1">
      <div className="container max-w-2xl py-12 md:py-16">
        <h1 className="heading-display text-2xl md:text-4xl mb-8">Inside Bars</h1>

        <p className="font-body text-[15px] md:text-base leading-relaxed text-foreground/80 mb-10">
          A live directory of what's on tonight in Berlin's bar scene — events,
          venues, neighborhoods.
        </p>

        <section className="mb-10">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/55 mb-3">
            Have a bar or want to host an event in a bar?
          </h2>
          <p className="font-body text-[14px] leading-relaxed text-foreground/80">
            Bar accounts and event publishing live on the web. Visit{" "}
            <a
              href="https://insidebars.co/for-organizers"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground font-medium underline underline-offset-2 hover:text-accent transition-colors"
            >
              insidebars.co
            </a>{" "}
            to sign in or create an account.
          </p>
        </section>

        <section>
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/55 mb-3">
            Legal
          </h2>
          <ul className="space-y-2 font-body text-[14px]">
            <li>
              <Link
                to="/impressum"
                className="text-foreground hover:text-accent transition-colors underline underline-offset-2"
              >
                Impressum
              </Link>
            </li>
            <li>
              <Link
                to="/datenschutz"
                className="text-foreground hover:text-accent transition-colors underline underline-offset-2"
              >
                Datenschutz
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
