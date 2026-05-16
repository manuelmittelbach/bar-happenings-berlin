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
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-12 md:gap-16">
          <div className="max-w-xs">
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
            className="grid grid-cols-2 sm:grid-cols-3 gap-x-10 gap-y-8 text-sm"
          >
            <div>
              <h3 className="mono-label text-primary-foreground/40 mb-3">Site</h3>
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/about"
                    className="text-primary-foreground/80 hover:text-primary-foreground transition-colors"
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link
                    to="/contact"
                    className="text-primary-foreground/80 hover:text-primary-foreground transition-colors"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mono-label text-primary-foreground/40 mb-3">Connect</h3>
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/instagram"
                    className="text-primary-foreground/80 hover:text-primary-foreground transition-colors"
                  >
                    Instagram
                  </Link>
                </li>
                <li>
                  <Link
                    to="/for-bars"
                    className="text-primary-foreground/80 hover:text-primary-foreground transition-colors"
                  >
                    For organizers
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mono-label text-primary-foreground/40 mb-3">Legal</h3>
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/impressum"
                    className="text-primary-foreground/80 hover:text-primary-foreground transition-colors"
                  >
                    Impressum
                  </Link>
                </li>
                <li>
                  <Link
                    to="/datenschutz"
                    className="text-primary-foreground/80 hover:text-primary-foreground transition-colors"
                  >
                    Datenschutz
                  </Link>
                </li>
              </ul>
            </div>
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
