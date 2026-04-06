import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { label: "Explore", path: "/" },
  { label: "For Bars", path: "/for-bars" },
  { label: "About", path: "/about" },
];

export default function Header() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b-2 border-foreground bg-background/95 backdrop-blur-sm">
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="font-heading text-xl font-extrabold uppercase tracking-tight">
          Inside Bars
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`mono-label transition-colors hover:text-foreground ${
                location.pathname === item.path
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/publish"
            className="hidden sm:inline-flex h-9 px-5 items-center justify-center border-2 border-foreground bg-foreground text-background font-heading text-xs font-bold uppercase tracking-wider transition-all hover:bg-background hover:text-foreground"
          >
            Publish Event
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t-2 border-foreground overflow-hidden"
          >
            <nav className="container flex flex-col gap-4 py-6">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`mono-label ${
                    location.pathname === item.path ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                to="/publish"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-11 w-full items-center justify-center border-2 border-foreground bg-foreground text-background font-heading text-xs font-bold uppercase tracking-wider"
              >
                Publish Event
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
