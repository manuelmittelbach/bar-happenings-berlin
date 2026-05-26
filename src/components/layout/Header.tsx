import { Link, useLocation, useNavigate } from "react-router-dom";
import { User, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/* Navigation items — Events + Map switcher + bar-owner pitch. About
 * moved to the footer to keep the header focused on primary discovery
 * surfaces. The Wordmark routes to `/` (Landing); Events is its own
 * nav item pointing at the events list on `/events`. */
const navItems: { label: string; path: string }[] = [
  { label: "Events", path: "/events" },
  { label: "Map", path: "/map" },
  { label: "Bars", path: "/bars" },
];

/* Wordmark — "Inside · Bars" with a 7px accent dot between the words.
 * Editorial serif via .heading-display (Georgia bold uppercase, tight
 * tracking) to match the Landing wordmark so the brand mark reads the
 * same across marketing and product surfaces. */
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

/* Compact "I·B" monogram — used on mobile web where the full wordmark
 * would crowd the nav row. Georgia bold uppercase "I" + accent dot + "B"
 * mirrors the desktop wordmark's structure ("Inside · Bars") in monogram
 * form. `normal-case` keeps the letters as written so the small accent
 * dot still reads as a separator rather than disappearing under all-caps
 * default tracking. */
function WordmarkCompact({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="heading-display normal-case inline-flex items-center"
      style={{ fontSize: 22 }}
      aria-label="Inside Bars — home"
    >
      <span style={{ marginRight: 2 }}>I</span>
      <span
        aria-hidden="true"
        className="rounded-full bg-accent"
        style={{ width: 5, height: 5, marginRight: 0 }}
      />
      <span style={{ marginLeft: 1 }}>B</span>
    </button>
  );
}

export default function Header() {
  const location = useLocation();
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  const visibleNavItems = navItems;

  const goHome = () => {
    navigate("/");
  };

  // Compare against the pathname only — the Sign-in icon links to
  // "/for-bars?view=signin", so the query string must be ignored for it to
  // get the active underline like Events / Map.
  const isActive = (path: string) => location.pathname === path.split("?")[0];

  /* Desktop nav link — flat mono caps 12px, 0.1em tracking (matches the
   * .mono-label utility used on the Landing nav), 2px bottom border on
   * active. Regular weight (400) reads as byline/eyebrow next to the
   * serif display headlines on the page. Optional `icon` lets the Admin
   * / Profile entries share the same flat treatment as plain text links
   * (no outlined-button chrome). */
  const NavLink = ({
    label,
    path,
    icon,
    ariaLabel,
  }: {
    label?: string;
    path: string;
    icon?: React.ReactNode;
    ariaLabel?: string;
  }) => {
    const active = isActive(path);
    return (
      <Link
        to={path}
        title={!label ? (ariaLabel ?? path.replace("/", "")) : undefined}
        aria-label={!label ? (ariaLabel ?? path.replace("/", "")) : undefined}
        className="transition-colors py-2 inline-flex items-center gap-1.5"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          fontWeight: 400,
          letterSpacing: "0.1em",
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
      <div className="container flex items-center gap-4" style={{ height: 56 }}>
        {/* Brand mark — full "Inside · Bars" wordmark on desktop, compact
            "I · B" monogram on mobile web (still left-aligned, nav stays
            right-aligned). Native iOS doesn't render the Header at all
            so neither variant ever shows in-app. */}
        <div className="md:hidden shrink-0">
          <WordmarkCompact onClick={goHome} />
        </div>
        <div className="hidden md:block">
          <Wordmark onClick={goHome} />
        </div>

        {/* Desktop nav — 28px gap, ml-auto pushes it to the right edge
            next to the wordmark. */}
        <nav className="hidden md:flex items-center md:ml-auto" style={{ gap: 28 }}>
          {visibleNavItems.map((item) => (
            <NavLink key={item.path} label={item.label} path={item.path} />
          ))}

          {!loading && !user && (
            <NavLink path="/for-bars?view=signin" icon={<User className="h-4 w-4" />} ariaLabel="Sign in" />
          )}

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

        {/* Mobile-web nav — same flat NavLink chrome as desktop, just
            laid out as a horizontal-scrollable row pushed to the right
            edge so the IB monogram can sit on the left. Native iOS
            doesn't render Header at all (replaced by the safe-area
            spacer in Layout), so this branch only runs in a mobile
            browser. */}
        <nav className="md:hidden flex flex-nowrap items-center gap-5 overflow-x-auto scrollbar-hide ml-auto">
          {visibleNavItems.map((item) => (
            <NavLink key={item.path} label={item.label} path={item.path} />
          ))}

          {!loading && !user && (
            <NavLink path="/for-bars?view=signin" icon={<User className="h-4 w-4" />} ariaLabel="Sign in" />
          )}

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
      </div>
    </header>
  );
}
