import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Menu, X, User, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { EXPLORE_SCROLL_KEY } from "@/pages/Index";
import { setDiscoverActive, useDiscoverActive } from "@/hooks/useDiscoverActive";

const navItems = [
  { label: "Discover", path: "/" },
  { label: "About", path: "/about" },
  { label: "For Bars", path: "/for-bars" },
];

type ActiveSection = "saved" | "manage" | "admin" | "profile" | "none";

const SECTION_KEY = "headerActiveSection";
const RESET_ROUTES = new Set([
  "/",
  "/about",
  "/for-bars",
  "/contact",
  "/login",
  "/map",
  "/reset-password",
]);
const SECTION_ROUTES: Record<string, ActiveSection> = {
  "/my-events": "saved",
  "/dashboard": "manage",
  "/admin": "admin",
  "/profile": "profile",
};

export default function Header() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const discoverActive = useDiscoverActive();
  const [activeSection, setActiveSection] = useState<ActiveSection>(() => {
    if (typeof window === "undefined") return "none";
    return (sessionStorage.getItem(SECTION_KEY) as ActiveSection) || "none";
  });

  useEffect(() => {
    if (location.pathname !== "/") {
      setDiscoverActive(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    const explicit = SECTION_ROUTES[location.pathname];
    if (explicit) {
      sessionStorage.setItem(SECTION_KEY, explicit);
      setActiveSection(explicit);
      return;
    }
    if (RESET_ROUTES.has(location.pathname)) {
      sessionStorage.removeItem(SECTION_KEY);
      setActiveSection("none");
    }
  }, [location.pathname]);

  const scrollToDateFilter = () => {
    const el = document.getElementById("date-filter-bar");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleDiscoverClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setDiscoverActive(true);
    if (location.pathname === "/") {
      scrollToDateFilter();
    } else {
      sessionStorage.setItem("inside-bars-scroll-to-filter", "1");
      sessionStorage.removeItem(EXPLORE_SCROLL_KEY);
      navigate("/");
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b-2 border-foreground bg-background/95 backdrop-blur-sm">
      <div className="container flex h-14 items-center justify-between">
        <button
          onClick={() => {
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
          }}
          className="font-heading text-xl font-extrabold uppercase tracking-tight inline-flex items-center gap-1.5"
        >
          Inside
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
          Bars
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => {
            const isActive =
              item.path === "/"
                ? location.pathname === "/" && discoverActive
                : location.pathname === item.path;
            const className = `mono-label transition-colors hover:text-foreground ${
              isActive ? "text-foreground" : "text-muted-foreground"
            }`;
            if (item.path === "/") {
              return (
                <button key={item.path} onClick={handleDiscoverClick} className={className}>
                  {item.label}
                </button>
              );
            }
            return (
              <Link key={item.path} to={item.path} className={className}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {!loading && (
            <>
              {role === "organizer" ? (
                <>
                  <Link
                    to="/my-events"
                    className={`hidden sm:inline-flex h-9 px-5 items-center justify-center border-2 border-foreground font-heading text-xs font-bold uppercase tracking-wider transition-all ${
                      activeSection === "saved"
                        ? "bg-foreground text-background"
                        : "text-foreground hover:bg-foreground hover:text-background"
                    }`}
                  >
                    Your Events
                  </Link>
                  <Link
                    to="/dashboard"
                    className={`hidden sm:inline-flex h-9 px-5 items-center justify-center border-2 border-foreground font-heading text-xs font-bold uppercase tracking-wider transition-all ${
                      activeSection === "manage"
                        ? "bg-foreground text-background"
                        : "text-foreground hover:bg-foreground hover:text-background"
                    }`}
                  >
                    Your Bar
                  </Link>
                </>
              ) : (
                <Link
                  to={user ? "/my-events" : "/login"}
                  state={user ? undefined : { from: "/my-events" }}
                  className={`hidden sm:inline-flex h-9 px-5 items-center justify-center border-2 border-foreground font-heading text-xs font-bold uppercase tracking-wider transition-all ${
                    activeSection === "saved"
                      ? "bg-foreground text-background"
                      : "text-foreground hover:bg-foreground hover:text-background"
                  }`}
                >
                  Your Events
                </Link>
              )}
              {role === "admin" && (
                <Link
                  to="/admin"
                  className={`hidden sm:inline-flex h-9 px-5 items-center justify-center gap-1.5 border-2 border-foreground font-heading text-xs font-bold uppercase tracking-wider transition-all ${
                    activeSection === "admin"
                      ? "bg-foreground text-background"
                      : "text-foreground hover:bg-foreground hover:text-background"
                  }`}
                >
                  <Shield className="h-3.5 w-3.5" />
                  Admin
                </Link>
              )}
              {user && (
                <Link
                  to="/profile"
                  className={`hidden sm:inline-flex h-9 w-9 items-center justify-center border-2 border-foreground transition-all hover:bg-foreground hover:text-background ${
                    activeSection === "profile" ? "bg-foreground text-background" : "text-foreground"
                  }`}
                  title="Profile"
                  aria-label="Profile"
                >
                  <User className="h-4 w-4" />
                </Link>
              )}
            </>
          )}
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
              {navItems.map((item) => {
                const isActive =
                  item.path === "/"
                    ? location.pathname === "/" && discoverActive
                    : location.pathname === item.path;
                const className = `mono-label ${
                  isActive ? "text-foreground" : "text-muted-foreground"
                } text-left`;
                if (item.path === "/") {
                  return (
                    <button
                      key={item.path}
                      onClick={(e) => {
                        setMobileOpen(false);
                        if (location.pathname === "/") {
                          setDiscoverActive(true);
                          setTimeout(() => scrollToDateFilter(), 250);
                        } else {
                          handleDiscoverClick(e);
                        }
                      }}
                      className={className}
                    >
                      {item.label}
                    </button>
                  );
                }
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={className}
                  >
                    {item.label}
                  </Link>
                );
              })}
              {role === "organizer" ? (
                <>
                  <Link
                    to="/my-events"
                    onClick={() => setMobileOpen(false)}
                    className={`inline-flex h-11 w-full items-center justify-center border-2 border-foreground font-heading text-xs font-bold uppercase tracking-wider ${
                      activeSection === "saved"
                        ? "bg-foreground text-background"
                        : "text-foreground"
                    }`}
                  >
                    Your Events
                  </Link>
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className={`inline-flex h-11 w-full items-center justify-center border-2 border-foreground font-heading text-xs font-bold uppercase tracking-wider ${
                      activeSection === "manage"
                        ? "bg-foreground text-background"
                        : "text-foreground"
                    }`}
                  >
                    Your Bar
                  </Link>
                </>
              ) : (
                <Link
                  to={user ? "/my-events" : "/login"}
                  state={user ? undefined : { from: "/my-events" }}
                  onClick={() => setMobileOpen(false)}
                  className={`inline-flex h-11 w-full items-center justify-center border-2 border-foreground font-heading text-xs font-bold uppercase tracking-wider ${
                    activeSection === "saved"
                      ? "bg-foreground text-background"
                      : "text-foreground"
                  }`}
                >
                  Your Events
                </Link>
              )}
              {role === "admin" && (
                <Link
                  to="/admin"
                  onClick={() => setMobileOpen(false)}
                  className={`inline-flex h-11 w-full items-center justify-center gap-2 border-2 border-foreground font-heading text-xs font-bold uppercase tracking-wider transition-colors ${
                    activeSection === "admin"
                      ? "bg-foreground text-background"
                      : "text-foreground hover:bg-foreground hover:text-background"
                  }`}
                >
                  <Shield className="h-4 w-4" /> Admin
                </Link>
              )}
              {user && (
                <Link
                  to="/profile"
                  onClick={() => setMobileOpen(false)}
                  className={`inline-flex h-11 w-full items-center justify-center gap-2 border-2 border-foreground font-heading text-xs font-bold uppercase tracking-wider transition-colors ${
                    activeSection === "profile"
                      ? "bg-foreground text-background"
                      : "text-foreground hover:bg-foreground hover:text-background"
                  }`}
                >
                  <User className="h-4 w-4" /> Profile
                </Link>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
