import { Link } from "react-router-dom";
import { Instagram } from "lucide-react";

/* TikTok mark — Lucide doesn't ship one, so this is the standard
 * single-color glyph at 24×24 viewBox so it sits on the same baseline
 * grid as lucide icons. */
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.91a8.16 8.16 0 0 0 4.77 1.52V7.4a4.85 4.85 0 0 1-1.84-.71z" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="border-t-2 border-foreground bg-foreground text-primary-foreground">
      <div className="container py-6">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_auto] lg:gap-16">
          {/* LEFT: copyright stamp + inline social icons, single row.
              Both icons route to the existing /instagram landing for
              now; swap routes here if separate pages get added later. */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
            <p className="font-mono text-xs tracking-tight text-primary-foreground/40">
              © 2026 Inside Bars
            </p>
            <span
              aria-hidden
              className="inline-block h-4 w-px bg-primary-foreground/20"
            />
            <div className="flex items-center gap-3">
              <Link
                to="/instagram"
                aria-label="Instagram"
                className="text-primary-foreground/60 hover:text-primary-foreground transition-colors"
              >
                <Instagram className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </Link>
              <Link
                to="/instagram"
                aria-label="TikTok"
                className="text-primary-foreground/60 hover:text-primary-foreground transition-colors"
              >
                <TikTokIcon className="h-[18px] w-[18px]" />
              </Link>
            </div>
          </div>

          {/* RIGHT: two flat link rows — primary nav on top, legal
              underneath at a smaller weight. No category headings;
              hierarchy carried by size and opacity. Instagram is
              promoted to the icon row on the left, so it's dropped
              from this text list to avoid duplicate entry. */}
          <div className="flex flex-col items-center gap-2 lg:items-end">
            <nav
              aria-label="Footer primary"
              className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm lg:justify-end"
            >
              <Link
                to="/about"
                className="text-primary-foreground/80 hover:text-primary-foreground transition-colors"
              >
                About
              </Link>
              <Link
                to="/contact"
                className="text-primary-foreground/80 hover:text-primary-foreground transition-colors"
              >
                Contact
              </Link>
              <Link
                to="/for-organizers"
                className="text-primary-foreground/80 hover:text-primary-foreground transition-colors"
              >
                For organizers
              </Link>
            </nav>
            <nav
              aria-label="Footer legal"
              className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-primary-foreground/40 lg:justify-end"
            >
              <Link
                to="/impressum"
                className="hover:text-primary-foreground transition-colors"
              >
                Impressum
              </Link>
              <Link
                to="/datenschutz"
                className="hover:text-primary-foreground transition-colors"
              >
                Datenschutz
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
