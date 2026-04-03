import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <Link to="/" className="font-heading text-xl font-bold tracking-tighter">
              barlin<span className="text-accent">.</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Discover what's happening tonight in Berlin's best small bars.
            </p>
          </div>
          <div>
            <h4 className="font-heading text-sm font-semibold mb-3">Discover</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/" className="hover:text-foreground transition-colors">Today</Link></li>
              <li><Link to="/explore" className="hover:text-foreground transition-colors">Explore Events</Link></li>
              <li><Link to="/explore?category=Live+Music" className="hover:text-foreground transition-colors">Live Music</Link></li>
              <li><Link to="/explore?category=Quiz+Nights" className="hover:text-foreground transition-colors">Quiz Nights</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-heading text-sm font-semibold mb-3">For Venues</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/for-bars" className="hover:text-foreground transition-colors">For Bars</Link></li>
              <li><Link to="/publish" className="hover:text-foreground transition-colors">Publish an Event</Link></li>
              <li><Link to="/login" className="hover:text-foreground transition-colors">Venue Login</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-heading text-sm font-semibold mb-3">Barlin</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/about" className="hover:text-foreground transition-colors">About</Link></li>
              <li><a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Instagram</a></li>
              <li><a href="mailto:hello@barlin.berlin" className="hover:text-foreground transition-colors">Contact</a></li>
              <li><span className="cursor-default">Legal</span></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">© 2026 barlin. Made in Berlin.</p>
          <p className="text-xs text-muted-foreground">Not a ticketing platform. Just good bars doing good things.</p>
        </div>
      </div>
    </footer>
  );
}
