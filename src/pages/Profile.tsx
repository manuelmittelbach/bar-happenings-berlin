import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { accountLinks } from "@/lib/roleNav";
import { PageSpinner } from "@/components/ui/page-spinner";

/* Account hub. The web header no longer surfaces role-specific tabs
 * ("Your Bar", "Admin") — they live here instead, alongside the account
 * details sub-page (/profile/details) and sign out. Open to every signed-in
 * role; the listed links depend on the role. */
export default function Profile() {
  const navigate = useNavigate();
  const { user, role, loading, roleResolved, signOut } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/signin", { replace: true });
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    // Land back on the sign-in surface (the account entry), not the
    // marketing landing page.
    navigate("/signin");
  };

  // Hold the spinner until the role is authoritative. Without this the page
  // renders the plain-user links for a beat (admin role lands a tick later
  // from the DB lookup), so "Your events" flashes and is briefly clickable
  // before it swaps to "Admin". See roleNav.ts for the why.
  if (loading || !user || !roleResolved) {
    return <PageSpinner />;
  }

  const links = accountLinks(role);

  return (
    <div className="container max-w-2xl pt-6 md:pt-8 pb-24">
      {/* Masthead — same compact pattern as the Bars directory: a
          heading-display 24/30px on a hairline rule. */}
      <header className="mb-6 md:mb-8">
        <div className="pt-2.5 pb-2.5 border-b-2 border-border">
          <h1 className="heading-display text-2xl md:text-[30px] leading-none m-0">Account</h1>
        </div>
      </header>

      <nav className="border-2 border-foreground divide-y-2 divide-foreground shadow-[0_18px_40px_-28px_hsla(18,85%,52%,0.3)]">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="group flex items-center justify-between px-4 py-4 font-mono text-sm font-bold uppercase tracking-[0.12em] text-foreground hover:bg-foreground hover:text-background transition-colors"
          >
            {l.label}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </nav>

      <div className="mt-8">
        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex items-center gap-2 h-11 px-5 border-2 border-foreground text-foreground font-mono text-xs font-bold uppercase tracking-widest hover:bg-foreground hover:text-background transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );
}
