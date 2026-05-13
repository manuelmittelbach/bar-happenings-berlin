import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Menu, X, User, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { EXPLORE_SCROLL_KEY } from "@/pages/Index";

/* Navigation items — For bars (bar-owner pitch + signin page) and About.
 * The Wordmark on the left already routes to home (the Tonight surface),
 * so a separate "Tonight" link in the nav was redundant. */
const navItems: { label: string; path: string }[] = [
  { label: "Map", path: "/map" },
  { label: "For organizer", path: "/for-bars" },
  { label: "About",    path: "/about" },
];

/* Wordmark — "Inside · Bars" with a 7px accent dot between the words.
 * Size matches the design's Wordmark size="md" (22px Syne extrabold,
 * 8px gap, no letter-spacing). */
function Wordmark({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="font-heading font-extrabold uppercase inline-flex items-center"
      style={{ fontSize: 22, gap: 8, letterSpacing: 0 }}
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
  );
}

export default function Header() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  const goHome = () => {
    sessionStorage.removeItem(EXPLORE_SCROLL_KEY);
    if (location.pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate("/");
      setTimeout(() => window.scrollTo({ top: 0, behavior: "auto" }), 50);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  /* Nav link — mono caps 11px, 0.12em tracking, 2px bottom border on
   * active. Regular weight (400) reads as byline/eyebrow next to the
   * serif display headlines on the page. Optional `icon` lets the
   * Admin / Profile entries share the same flat treatment as plain
   * text links (no outlined-button chrome). */
  const NavLink = ({
    label,
    path,
    icon,
  }: {
    label?: string;
    path: string;
    icon?: React.ReactNode;
  }) => {
    const active = isActive(path);
    return (
      <Link
        to={path}
        title={!label ? path.replace("/", "") : undefined}
        aria-label={!label ? path.replace("/", "") : undefined}
        className="transition-colors py-2 inline-flex items-center gap-1.5"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 400,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: active ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
          textDecoration: "none",
          borderBottom: active ? "2px solid hsl(var(--foreground))" : "2px solid transparent",
        }}
      >
        {icon}
        {label}
      </Link>
    );
  };

  return (
    <header
      className="sticky top-0 z-50 border-b-2 border-foreground backdrop-blur-md"
      style={{ backgroundColor: "hsl(var(--background) / 0.95)" }}
    >
      <div className="container flex items-center justify-between" style={{ height: 64 }}>
        <Wordmark onClick={goHome} />

        {/* Desktop nav — 28px gap between links, then the role-aware right
            cluster. Hidden under md; mobile uses the menu drawer below. */}
        <nav className="hidden md:flex items-center" style={{ gap: 28 }}>
          {navItems.map((item) => (
            <NavLink key={item.path} label={item.label} path={item.path} />
          ))}

          {!loading && user && (
            <>
              {role === "organizer" && (
                <NavLink label="Your Bar" path="/dashboard" />
              )}
              {role === "admin" && (
                <NavLink label="Admin" path="/admin" icon={<Shield className="h-3 w-3" />} />
              )}
              <NavLink path="/profile" icon={<User className="h-4 w-4" />} />
            </>
          )}
        </nav>

        {/* Mobile menu trigger — p-3 + h-5 w-5 icon = 44×44 hit area, the
            minimum Apple HIG / WCAG 2.5.5 AA recommend for touch targets.
            Previously p-2 (36×36) was below the threshold and prone to
            mis-taps on thumb-typing distances. */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden inline-flex items-center justify-center p-3 -mr-3"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile nav — same link labels and order, full-width buttons,
          opens/closes with a height transition. */}
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
                  className="text-left transition-colors"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: isActive(item.path) ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                  }}
                >
                  {item.label}
                </Link>
              ))}

              {!loading && user && (
                <>
                  {role === "organizer" && (
                    <Link
                      to="/dashboard"
                      onClick={() => setMobileOpen(false)}
                      className="inline-flex h-11 w-full items-center justify-center border-2 border-foreground font-heading text-xs font-bold uppercase tracking-wider"
                    >
                      Your Bar
                    </Link>
                  )}
                  {role === "admin" && (
                    <Link
                      to="/admin"
                      onClick={() => setMobileOpen(false)}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 border-2 border-foreground font-heading text-xs font-bold uppercase tracking-wider"
                    >
                      <Shield className="h-4 w-4" /> Admin
                    </Link>
                  )}
                  <Link
                    to="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 border-2 border-foreground font-heading text-xs font-bold uppercase tracking-wider"
                  >
                    <User className="h-4 w-4" /> Profile
                  </Link>
                </>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
