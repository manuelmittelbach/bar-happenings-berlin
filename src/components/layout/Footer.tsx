import { Link, useLocation, useNavigate } from "react-router-dom";
import { EXPLORE_SCROLL_KEY } from "@/pages/Index";
import { setDiscoverActive } from "@/hooks/useDiscoverActive";

export default function Footer() {
  const navigate = useNavigate();
  const location = useLocation();

  const goHome = () => {
    sessionStorage.removeItem(EXPLORE_SCROLL_KEY);
    setDiscoverActive(false);

    const scrollToTop = (smooth = false) => {
      window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    if (location.pathname === "/") {
      scrollToTop(true);
    } else {
      navigate("/");
      setTimeout(() => scrollToTop(), 50);
    }
  };

  return (
    <footer className="border-t-2 border-foreground bg-foreground text-primary-foreground">
      <div className="container py-12">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-10 text-center md:text-left">
          <div className="max-w-xs mx-auto md:mx-0">
            <button
              onClick={goHome}
              className="font-heading text-2xl font-extrabold uppercase tracking-tight inline-flex items-center"
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

          <div className="flex flex-wrap justify-center gap-12 text-center md:text-left">
            <div className="text-center md:text-left">
              <h4 className="mono-label text-primary-foreground/40 mb-4">Info</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <span className="text-primary-foreground/70 cursor-default">Instagram</span>
                </li>
                <li>
                  <Link
                    to="/contact"
                    className="text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            <div className="text-center md:text-left">
              <h4 className="mono-label text-primary-foreground/40 mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    to="/impressum"
                    className="text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                  >
                    Impressum
                  </Link>
                </li>
                <li>
                  <Link
                    to="/datenschutz"
                    className="text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                  >
                    Datenschutz
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-primary-foreground/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
          <p className="mono-label text-primary-foreground/30">© 2026 Inside Bars — Made in Berlin</p>
          <p className="text-xs text-primary-foreground/30 font-mono">No algorithms. No sponsors. Just bars.</p>
        </div>
      </div>
    </footer>
  );
}
