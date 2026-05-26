import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PageSpinner } from "@/components/ui/page-spinner";

/* Account hub. The web header no longer surfaces role-specific tabs
 * ("Your Bar", "Admin") — they live here instead, alongside the account
 * details sub-page (/profile/details) and sign out. Open to every signed-in
 * role; the listed links depend on the role. */
export default function Profile() {
  const navigate = useNavigate();
  const { user, role, loading, signOut } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/for-bars", { replace: true });
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading || !user) {
    return <PageSpinner />;
  }

  const links: { label: string; to: string }[] = [];
  if (role === "organizer") {
    links.push({ label: "Your events", to: "/dashboard" });
    links.push({ label: "Your bar", to: "/bar-account" });
  }
  if (role === "admin") {
    links.push({ label: "Admin", to: "/admin" });
  }
  links.push({ label: "Profile details", to: "/profile/details" });

  return (
    <div className="container max-w-2xl py-10 md:py-14">
      <div className="mb-10 md:mb-14 border-b-2 border-foreground pb-6">
        <h1 className="heading-display text-4xl md:text-5xl leading-[0.95]">Account</h1>
      </div>

      <nav className="border-2 border-foreground divide-y-2 divide-foreground">
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
