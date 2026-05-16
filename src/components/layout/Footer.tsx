import { Link, useLocation, useNavigate } from "react-router-dom";
import { EXPLORE_SCROLL_KEY, SCROLL_HOME_EVENT } from "@/pages/Index";
import { setDiscoverActive } from "@/hooks/useDiscoverActive";

export default function Footer() {
  const navigate = useNavigate();
  const location = useLocation();

  const goHome = () => {
    sessionStorage.removeItem(EXPLORE_SCROLL_KEY);
    setDiscoverActive(false);

    if (location.pathname === "/") {
      // Index scrolls its internal container, not the window. Dispatch the
      // shared scroll-home event so Index moves its scrollRef to the top.
      window.dispatchEvent(new CustomEvent(SCROLL_HOME_EVENT));
    } else {
      navigate("/");
      setTimeout(() => window.dispatchEvent(new CustomEvent(SCROLL_HOME_EVENT)), 50);
    }
  };

  return (
    <footer className="border-t-2 border-foreground bg-foreground text-primary-foreground">
      <div className="container py-12">
        {/* Footer head — wordmark + tagline on the left, a single flat row
            of links on the right. With only four items left after dropping
            the Discover column, two stub columns ("INFO" / "LEGAL", two
            items each) read as filler; one inline row separated by mono
            dots fits the editorial tone of the rest of the page. */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 text-center md:text-left">
          <div className="max-w-xs mx-auto md:mx-0">
            <button
              onClick={goHome}
              className="heading-display text-2xl inline-flex items-center"
              style={{ gap: 8 }}
              aria-label="Inside Bars — home"
            >
              Inside
              <span
                aria-hidden="true"
                className="rounded-full bg-accent"
                style={{ width: 7, height: 7 }}
              />
              Bars
            </button>
            <p className="mt-3 text-sm text-primary-foreground/60 leading-relaxed">
              A curated guide to good bars doing good things.
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="flex flex-wrap justify-center md:justify-end items-center gap-x-3 gap-y-2 text-sm"
          >
            <Link
              to="/for-bars"
              className="text-primary-foreground/70 hover:text-primary-foreground transition-colors"
            >
              For organizer
            </Link>
            <span aria-hidden="true" className="text-primary-foreground/25 font-mono text-xs">·</span>
            <Link
              to="/about"
              className="text-primary-foreground/70 hover:text-primary-foreground transition-colors"
            >
              About
            </Link>
            <span aria-hidden="true" className="text-primary-foreground/25 font-mono text-xs">·</span>
            <Link
              to="/contact"
              className="text-primary-foreground/70 hover:text-primary-foreground transition-colors"
            >
              Contact
            </Link>
            <span aria-hidden="true" className="text-primary-foreground/25 font-mono text-xs">·</span>
            <Link
              to="/instagram"
              className="text-primary-foreground/70 hover:text-primary-foreground transition-colors"
            >
              Instagram
            </Link>
            <span aria-hidden="true" className="text-primary-foreground/25 font-mono text-xs">·</span>
            <Link
              to="/impressum"
              className="text-primary-foreground/70 hover:text-primary-foreground transition-colors"
            >
              Impressum
            </Link>
            <span aria-hidden="true" className="text-primary-foreground/25 font-mono text-xs">·</span>
            <Link
              to="/datenschutz"
              className="text-primary-foreground/70 hover:text-primary-foreground transition-colors"
            >
              Datenschutz
            </Link>
          </nav>
        </div>

        <div className="mt-10 pt-6 border-t border-primary-foreground/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
          <p className="mono-label text-primary-foreground/30">© 2026 Inside Bars — Made in Berlin</p>
          <p className="text-xs text-primary-foreground/30 font-mono">No algorithms. No sponsors. Just bars.</p>
        </div>
      </div>
    </footer>
  );
}
