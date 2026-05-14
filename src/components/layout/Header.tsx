import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Menu, X, User, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { EXPLORE_SCROLL_KEY } from "@/pages/Index";

/* Navigation items — bar-owner pitch + signin page only. Map was
 * removed from the header: the desktop Map FAB on the index page and
 * the native BottomTabBar's Map tab already expose the surface, so a
 * third entry in the header chrome was redundant. About moved to the
 * footer to keep the header focused on primary discovery surfaces.
 * The Wordmark on the left already routes to home (the Tonight surface),
 * so a separate "Tonight" link is redundant. */
const navItems: { label: string; path: string }[] = [
  { label: "For organizer", path: "/for-bars" },
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

  // "For organizer" is the pitch page that recruits bar owners. Once a
  // user is already an organizer or admin, the pitch is redundant and
  // just eats horizontal space in the nav.
  const visibleNavItems = navItems.filter((item) => {
    if (item.path === "/for-bars" && user && (role === "organizer" || role === "admin")) return false;
    return true;
  });

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
      style={{
        backgroundColor: "hsl(var(--background) / 0.95)",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div className="container flex items-center justify-between" style={{ height: 64 }}>
        <Wordmark onClick={goHome} />

        {/* Desktop nav — 28px gap between links, then the role-aware right
            cluster. Hidden under md; mobile uses the menu drawer below. */}
        <nav className="hidden md:flex items-center" style={{ gap: 28 }}>
          {visibleNavItems.map((item) => (
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

      {/* Mobile nav — drops down from below the header. Primary nav items
          (Map / For organizer) lay out in a horizontal row to save
          vertical space; auth/role buttons stay stacked underneath because
          they're full-width affordances. */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t-2 border-foreground overflow-hidden"
          >
            <nav className="container py-5">
              <div className="flex flex-nowrap items-center gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
                {visibleNavItems.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={`shrink-0 inline-flex h-9 items-center px-2.5 border-2 transition-colors ${
                        active
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                      }`}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                      }}
                    >
                      {item.label}
                    </Link>
                  );
                })}

                {!loading && user && (
                  <>
                    {role === "organizer" && (() => {
                      const active = isActive("/dashboard");
                      return (
                        <Link
                          to="/dashboard"
                          onClick={() => setMobileOpen(false)}
                          className={`shrink-0 inline-flex h-9 items-center px-2.5 border-2 transition-colors ${
                            active
                              ? "border-foreground bg-foreground text-background"
                              : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                          }`}
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                          }}
                        >
                          Your Bar
                        </Link>
                      );
                    })()}
                    {role === "admin" && (() => {
                      const active = isActive("/admin");
                      return (
                        <Link
                          to="/admin"
                          onClick={() => setMobileOpen(false)}
                          className={`shrink-0 inline-flex h-9 items-center gap-1.5 px-2.5 border-2 transition-colors ${
                            active
                              ? "border-foreground bg-foreground text-background"
                              : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                          }`}
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                          }}
                        >
                          <Shield className="h-3.5 w-3.5" /> Admin
                        </Link>
                      );
                    })()}
                    {(() => {
                      const active = isActive("/profile");
                      return (
                        <Link
                          to="/profile"
                          onClick={() => setMobileOpen(false)}
                          aria-label="Profile"
                          className={`shrink-0 inline-flex h-9 w-9 items-center justify-center border-2 transition-colors ${
                            active
                              ? "border-foreground bg-foreground text-background"
                              : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                          }`}
                        >
                          <User className="h-4 w-4" />
                        </Link>
                      );
                    })()}
                  </>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
