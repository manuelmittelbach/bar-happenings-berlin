import { Link, useLocation, useNavigate } from "react-router-dom";
import { User } from "lucide-react";
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

/* Compact bordered "iB" logo — mirrors the confirmation-email monogram.
   Shown below 480px in place of the full wordmark to keep the nav tabs
   visible instead of collapsing into a burger menu. */
function WordmarkLogo({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center border-2 border-foreground shrink-0"
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        fontSize: 22,
        fontWeight: 900,
        letterSpacing: "-1px",
        lineHeight: 1,
      }}
      aria-label="Inside Bars — home"
    >
      iB
    </button>
  );
}

export default function Header() {
  const location = useLocation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const goHome = () => {
    navigate("/");
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
          {/* Brand: full "Inside · Bars" wordmark from 480px up,
              compact bordered "iB" logo below to make room for the tabs */}
          <span className="hidden min-[480px]:inline-flex">
            <Wordmark onClick={goHome} />
          </span>
          <span className="min-[480px]:hidden inline-flex">
            <WordmarkLogo onClick={goHome} />
          </span>

          {/* Nav — always visible; tighter gap on small screens, no burger */}
          <nav className="flex items-center ml-auto gap-4 min-[480px]:gap-[28px]">
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
        </div>
      </header>
    </>
  );
}
