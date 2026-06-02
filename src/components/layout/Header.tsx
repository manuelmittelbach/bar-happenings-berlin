import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, User, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const navItems: { label: string; path: string }[] = [
  { label: "Events", path: "/events" },
  { label: "Map", path: "/map" },
  { label: "Bars", path: "/bars" },
];

function Wordmark({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="heading-display inline-flex items-center"
      style={{ fontSize: 20, gap: 8 }}
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

/* WordmarkCompact ("iB") kept for reference — currently unused.
   Restore by swapping the md:hidden block below back to use it. */
// function WordmarkCompact({ onClick }: { onClick: () => void }) { ... }

export default function Header() {
  const location = useLocation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const goHome = () => {
    navigate("/");
    setMenuOpen(false);
  };

  const isActive = (path: string) =>
    path.includes("?")
      ? location.pathname + location.search === path
      : location.pathname === path;

  const NavLink = ({
    label,
    path,
    icon,
    ariaLabel,
    onClick,
    bold,
  }: {
    label?: string;
    path: string;
    icon?: React.ReactNode;
    ariaLabel?: string;
    onClick?: () => void;
    /* When set (mobile dropdown), the active item is shown bold instead
       of with an underline — the burger menu rows read cleaner that way. */
    bold?: boolean;
  }) => {
    const active = isActive(path);
    return (
      <Link
        to={path}
        title={!label ? (ariaLabel ?? path.replace("/", "")) : undefined}
        aria-label={!label ? (ariaLabel ?? path.replace("/", "")) : undefined}
        onClick={onClick}
        className="transition-colors py-2 inline-flex items-center gap-1.5"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          fontWeight: bold && active ? 700 : 400,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: active ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
          textDecoration: "none",
          borderBottom: bold
            ? "none"
            : active
              ? "2px solid hsl(var(--foreground))"
              : "2px solid transparent",
        }}
      >
        {icon}
        {label}
      </Link>
    );
  };

  return (
    <>
      <header
        className="sticky top-0 z-50 border-b-2 border-foreground"
        style={{
          backgroundColor: "hsl(var(--background))",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="container flex items-center gap-4" style={{ height: 56 }}>
          {/* Wordmark — always full "Inside · Bars" on all viewports */}
          <Wordmark onClick={goHome} />

          {/* Desktop nav */}
          <nav className="hidden min-[480px]:flex items-center ml-auto" style={{ gap: 28 }}>
            {navItems.map((item) => (
              <NavLink key={item.path} label={item.label} path={item.path} />
            ))}
            {!loading && !user && (
              <NavLink path="/signin" icon={<User className="h-4 w-4" />} ariaLabel="Sign in" />
            )}
            {!loading && user && (
              <NavLink path="/profile" icon={<User className="h-4 w-4" />} />
            )}
          </nav>

          {/* Mobile burger button */}
          <button
            className="min-[480px]:hidden ml-auto flex items-center justify-center"
            style={{ width: 36, height: 36 }}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? (
              <X className="h-5 w-5" strokeWidth={2} />
            ) : (
              <Menu className="h-5 w-5" strokeWidth={2} />
            )}
          </button>
        </div>
      </header>

      {/* Mobile dropdown — z-[10000] sits above the map's z-[9999] tiles */}
      {menuOpen && (
        <div
          className="min-[480px]:hidden fixed inset-x-0 z-[10000] border-b-2 border-foreground"
          style={{
            top: `calc(56px + env(safe-area-inset-top))`,
            backgroundColor: "hsl(var(--background))",
          }}
        >
          <nav className="container flex flex-col items-start py-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                label={item.label}
                path={item.path}
                bold
                onClick={() => setMenuOpen(false)}
              />
            ))}
            {!loading && !user && (
              <NavLink
                path="/signin"
                icon={<User className="h-4 w-4" />}
                ariaLabel="Sign in"
                bold
                onClick={() => setMenuOpen(false)}
              />
            )}
            {!loading && user && (
              <NavLink
                path="/profile"
                icon={<User className="h-4 w-4" />}
                ariaLabel="Profile"
                bold
                onClick={() => setMenuOpen(false)}
              />
            )}
          </nav>
        </div>
      )}
    </>
  );
}
