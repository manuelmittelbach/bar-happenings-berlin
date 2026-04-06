import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container py-12">
        <div className="flex flex-col md:flex-row justify-between gap-10">
          <div className="max-w-xs">
            <Link to="/" className="font-heading text-2xl tracking-wide text-foreground uppercase">
              Barlin
            </Link>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Your guide to Berlin's bar scene. Real bars, real people, real nights out.
            </p>
          </div>
          <div className="flex flex-wrap gap-12">
            <div>
              <h4 className="mono-label text-foreground mb-4">Discover</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">Today</Link></li>
                <li><Link to="/explore" className="text-muted-foreground hover:text-foreground transition-colors">Explore</Link></li>
                <li><Link to="/explore?category=Live+Music" className="text-muted-foreground hover:text-foreground transition-colors">Live Music</Link></li>
                <li><Link to="/explore?category=Quiz+Nights" className="text-muted-foreground hover:text-foreground transition-colors">Quiz Nights</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mono-label text-foreground mb-4">Venues</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/for-bars" className="text-muted-foreground hover:text-foreground transition-colors">For Bars</Link></li>
                <li><Link to="/publish" className="text-muted-foreground hover:text-foreground transition-colors">Publish Event</Link></li>
                <li><Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors">Login</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mono-label text-foreground mb-4">Info</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">About</Link></li>
                <li><a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">Instagram</a></li>
                <li><a href="mailto:hello@barlin.berlin" className="text-muted-foreground hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="mono-label text-muted-foreground/50">&copy; 2026 Barlin &mdash; Made in Berlin</p>
          <p className="text-xs text-muted-foreground/50 font-mono">No algorithms. No sponsors. Just bars.</p>
        </div>
      </div>
    </footer>
  );
}