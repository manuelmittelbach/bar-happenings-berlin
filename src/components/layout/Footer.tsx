import { Link, useNavigate } from "react-router-dom";
import { EXPLORE_SCROLL_KEY } from "@/pages/Index";

export default function Footer() {
  const navigate = useNavigate();

  const goToCategory = (category: string) => {
    sessionStorage.setItem("inside-bars-scroll-to-filter", "1");
    sessionStorage.removeItem(EXPLORE_SCROLL_KEY);
    navigate(`/?category=${encodeURIComponent(category)}`);
  };

  return (
    <footer className="border-t-2 border-foreground bg-foreground text-primary-foreground">
      <div className="container py-12">
        <div className="flex flex-col md:flex-row justify-between gap-10">
          <div className="max-w-xs">
            <Link to="/" className="font-heading text-2xl font-extrabold uppercase tracking-tight">
              Inside Bars
            </Link>
            <p className="mt-3 text-sm text-primary-foreground/60 leading-relaxed">
              What's on tonight in Berlin's independent bars. Not a ticketing platform — just good bars doing good things.
            </p>
          </div>
          <div className="flex flex-wrap gap-12">
            <div>
              <h4 className="mono-label text-primary-foreground/40 mb-4">Discover</h4>
              <ul className="space-y-2 text-sm">
                <li><button onClick={() => goToCategory("Live Music")} className="text-primary-foreground/70 hover:text-primary-foreground transition-colors text-left">Live Music</button></li>
                <li><button onClick={() => goToCategory("Pub Quiz")} className="text-primary-foreground/70 hover:text-primary-foreground transition-colors text-left">Quiz Nights</button></li>
              </ul>
            </div>
            <div>
              <h4 className="mono-label text-primary-foreground/40 mb-4">Venues</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/for-bars" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">For Bars</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mono-label text-primary-foreground/40 mb-4">Info</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/about" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">About</Link></li>
                <li><span className="text-primary-foreground/70 cursor-default">Instagram</span></li>
                <li>
                  <a
                    href="mailto:hello@insidebars.co"
                    className="text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-primary-foreground/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="mono-label text-primary-foreground/30">© 2026 Inside Bars — Made in Berlin</p>
          <p className="text-xs text-primary-foreground/30 font-mono">No algorithms. No sponsors. Just bars.</p>
        </div>
      </div>
    </footer>
  );
}
