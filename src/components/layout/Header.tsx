import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Menu, X, User, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { EXPLORE_SCROLL_KEY } from "@/pages/Index";

/* Navigation items — order and labels lifted verbatim from the design's
 * Header.jsx: Tonight (the home / discover surface), For bars (organizer
 * sign-in / pitch page), About. */
const navItems: { label: string; path: string }[] = [
  { label: "Tonight",  path: "/" },
  { label: "For bars", path: "/for-bars" },
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

  // Tonight click — scrolls down to the category/day-filter bar so the
  // user lands inside the events list, not at the top of the hero. When
  // we're on a different route, set a sessionStorage flag and navigate;
  // Index.tsx reads the flag on mount and performs the scroll.
  const scrollToDateFilter = () => {
    document.getElementById("date-filter-bar")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleTonightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setMobileOpen(false);
    if (location.pathname === "/") {
      scrollToDateFilter();
    } else {
      sessionStorage.setItem("inside-bars-scroll-to-filter", "1");
      sessionStorage.removeItem(EXPLORE_SCROLL_KEY);
      navigate("/");
    }
  };

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname === path;

  /* Nav link — mono caps 11px, 0.12em tracking, 2px bottom border on
   * active (foreground) / transparent on inactive. Identical to the
   * `link()` helper in the design's Header.jsx. */
  const NavLink = ({ label, path }: { label: string; path: string }) => {
    const active = isActive(path);
    const isTonight = path === "/";
    return (
      <Link
        to={path}
        onClick={isTonight ? handleTonightClick : undefined}
        className="transition-colors py-2"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: active ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
          textDecoration: "none",
          borderBottom: active ? "2px solid hsl(var(--foreground))" : "2px solid transparent",
        }}
      >
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

          {!loading && (
            <>
              {!user ? (
                /* Unauthenticated → Sign in goes to /login with a `from`
                   redirect to /my-events, matching the main branch's
                   wiring. /for-bars is the organizer pitch page; the
                   login route owns the actual auth form. */
                <Link
                  to="/login"
                  state={{ from: "/my-events" }}
                  className="inline-flex items-center justify-center border-2 border-foreground bg-transparent text-foreground hover:bg-foreground hover:text-background transition-colors font-heading font-bold uppercase"
                  style={{ height: 38, padding: "0 20px", fontSize: 12, letterSpacing: "0.1em" }}
                >
                  Sign in
                </Link>
              ) : (
                /* Authenticated → keep the role-aware clusters but
                   restyle to match the design's btn-outline (height 38). */
                <>
                  {role === "organizer" ? (
                    <>
                      <Link
                        to="/my-events"
                        className={`inline-flex items-center justify-center border-2 border-foreground font-heading font-bold uppercase transition-colors ${
                          isActive("/my-events")
                            ? "bg-foreground text-background"
                            : "text-foreground hover:bg-foreground hover:text-background"
                        }`}
                        style={{ height: 38, padding: "0 16px", fontSize: 12, letterSpacing: "0.1em" }}
                      >
                        Your Events
                      </Link>
                      <Link
                        to="/dashboard"
                        className={`inline-flex items-center justify-center border-2 border-foreground font-heading font-bold uppercase transition-colors ${
                          isActive("/dashboard")
                            ? "bg-foreground text-background"
                            : "text-foreground hover:bg-foreground hover:text-background"
                        }`}
                        style={{ height: 38, padding: "0 16px", fontSize: 12, letterSpacing: "0.1em" }}
                      >
                        Your Bar
                      </Link>
                    </>
                  ) : (
                    <Link
                      to="/my-events"
                      className={`inline-flex items-center justify-center border-2 border-foreground font-heading font-bold uppercase transition-colors ${
                        isActive("/my-events")
                          ? "bg-foreground text-background"
                          : "text-foreground hover:bg-foreground hover:text-background"
                      }`}
                      style={{ height: 38, padding: "0 16px", fontSize: 12, letterSpacing: "0.1em" }}
                    >
                      Your Events
                    </Link>
                  )}
                  {role === "admin" && (
                    <Link
                      to="/admin"
                      className={`inline-flex items-center justify-center gap-1.5 border-2 border-foreground font-heading font-bold uppercase transition-colors ${
                        isActive("/admin")
                          ? "bg-foreground text-background"
                          : "text-foreground hover:bg-foreground hover:text-background"
                      }`}
                      style={{ height: 38, padding: "0 14px", fontSize: 12, letterSpacing: "0.1em" }}
                    >
                      <Shield className="h-3.5 w-3.5" /> Admin
                    </Link>
                  )}
                  <Link
                    to="/profile"
                    className={`inline-flex items-center justify-center border-2 border-foreground transition-colors ${
                      isActive("/profile") ? "bg-foreground text-background" : "text-foreground hover:bg-foreground hover:text-background"
                    }`}
                    style={{ height: 38, width: 38 }}
                    title="Profile"
                    aria-label="Profile"
                  >
                    <User className="h-4 w-4" />
                  </Link>
                </>
              )}
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
              {navItems.map((item) => {
                const isTonight = item.path === "/";
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={isTonight ? handleTonightClick : () => setMobileOpen(false)}
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
                );
              })}

              {!loading && !user && (
                <Link
                  to="/login"
                  state={{ from: "/my-events" }}
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-11 w-full items-center justify-center border-2 border-foreground font-heading text-xs font-bold uppercase tracking-wider"
                >
                  Sign in
                </Link>
              )}

              {!loading && user && (
                <>
                  {role === "organizer" ? (
                    <>
                      <Link
                        to="/my-events"
                        onClick={() => setMobileOpen(false)}
                        className="inline-flex h-11 w-full items-center justify-center border-2 border-foreground font-heading text-xs font-bold uppercase tracking-wider"
                      >
                        Your Events
                      </Link>
                      <Link
                        to="/dashboard"
                        onClick={() => setMobileOpen(false)}
                        className="inline-flex h-11 w-full items-center justify-center border-2 border-foreground font-heading text-xs font-bold uppercase tracking-wider"
                      >
                        Your Bar
                      </Link>
                    </>
                  ) : (
                    <Link
                      to="/my-events"
                      onClick={() => setMobileOpen(false)}
                      className="inline-flex h-11 w-full items-center justify-center border-2 border-foreground font-heading text-xs font-bold uppercase tracking-wider"
                    >
                      Your Events
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
