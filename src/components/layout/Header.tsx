import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { EXPLORE_SCROLL_KEY } from "@/pages/Index";

const navItems = [
  { label: "Discover", path: "/" },
  { label: "About", path: "/about" },
];

export default function Header() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const scrollToDateFilter = () => {
    const el = document.getElementById("date-filter-bar");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleDiscoverClick = (e: React.MouseEvent) => {
    e.preventDefault();
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
          className="font-heading text-xl font-extrabold uppercase tracking-tight"
        >
          Inside Bars
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => {
            const className = `mono-label transition-colors hover:text-foreground ${
              location.pathname === item.path ? "text-foreground" : "text-muted-foreground"
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
              <Link
                to={role === "admin" ? "/admin" : role === "organizer" ? "/dashboard" : user ? "/my-events" : "/login"}
                state={user ? undefined : { from: "/my-events" }}
                className="hidden sm:inline-flex h-9 px-5 items-center justify-center border-2 border-foreground bg-foreground text-background font-heading text-xs font-bold uppercase tracking-wider transition-all hover:bg-background hover:text-foreground"
              >
                {role === "admin" ? "Dashboard" : "My Events"}
              </Link>
              {user && (
                <button
                  onClick={async () => { await signOut(); navigate("/login"); }}
                  className="hidden sm:inline-flex h-9 w-9 items-center justify-center border-2 border-foreground text-foreground transition-all hover:bg-foreground hover:text-background"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
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
                const className = `mono-label ${
                  location.pathname === item.path ? "text-foreground" : "text-muted-foreground"
                } text-left`;
                if (item.path === "/") {
                  return (
                    <button
                      key={item.path}
                      onClick={(e) => {
                        setMobileOpen(false);
                        if (location.pathname === "/") {
                          setTimeout(() => {
                            const el = document.getElementById("date-filter-bar");
                            el?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }, 250);
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
              <Link
                to={role === "admin" ? "/admin" : role === "organizer" ? "/dashboard" : user ? "/my-events" : "/login"}
                state={user ? undefined : { from: "/my-events" }}
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-11 w-full items-center justify-center border-2 border-foreground bg-foreground text-background font-heading text-xs font-bold uppercase tracking-wider"
              >
                {role === "admin" ? "Dashboard" : "My Events"}
              </Link>
              {user && (
                <button
                  onClick={async () => { await signOut(); navigate("/login"); setMobileOpen(false); }}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 border-2 border-foreground text-foreground font-heading text-xs font-bold uppercase tracking-wider hover:bg-foreground hover:text-background transition-colors"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
