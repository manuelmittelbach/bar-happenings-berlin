import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, KeyRound, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { fetchProfile, updateProfile } from "@/lib/supabaseQueries";
import { Spinner } from "@/components/ui/spinner";

const inputClass =
  "w-full h-11 px-3 bg-background border-2 border-foreground text-sm font-body outline-none focus:bg-muted/40 transition-colors";

export default function Profile() {
  const navigate = useNavigate();
  const { user, role, approvalStatus, loading, signOut, resetPassword } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login", { replace: true, state: { from: "/profile" } });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchProfile(user.id).then((p) => {
      if (p) {
        setFirstName(p.firstName);
        setLastName(p.lastName);
      }
      setInitialized(true);
    });
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile(user.id, { firstName: firstName.trim(), lastName: lastName.trim() });
      toast.success("Profile updated.");
    } catch {
      toast.error("Couldn't save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    setResetting(true);
    try {
      await resetPassword(user.email);
      toast.success("Password reset link sent.", {
        description: `Check ${user.email} for the link.`,
      });
    } catch {
      toast.error("Couldn't send reset email. Please try again.");
    } finally {
      setResetting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  if (loading || !user || !initialized) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const roleLabel =
    role === "admin" ? "Admin" : role === "organizer" ? "Bar Organizer" : "Member";
  const showApprovalBadge = role === "organizer" && approvalStatus !== "approved";
  const approvalColor =
    approvalStatus === "rejected"
      ? "bg-red-500/10 text-red-600 border-red-500/40"
      : "bg-yellow-500/10 text-yellow-700 border-yellow-500/40";

  return (
    <div className="container max-w-2xl py-10 md:py-14">
      {/* Header */}
      <div className="mb-10 md:mb-14 border-b-2 border-foreground pb-6">
        <p className="mono-label text-accent mb-3">Your account</p>
        <h1 className="heading-display text-4xl md:text-5xl leading-[0.95]">Profile</h1>
        <p className="mt-4 text-sm text-muted-foreground max-w-md leading-relaxed">
          Update the details linked to your account. Your email is what you sign in with — contact us if it needs to change.
        </p>
      </div>

      {/* Identity block */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="mono-label text-foreground">Identity</h2>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider border border-border bg-muted text-muted-foreground">
            {roleLabel}
          </span>
        </div>

        {showApprovalBadge && (
          <div className={`mb-5 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium border ${approvalColor}`}>
            {approvalStatus === "rejected" ? "Application not approved" : "Awaiting admin approval"}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          {/* Email — read-only */}
          <div className="space-y-1.5">
            <label className="mono-label text-muted-foreground">Email</label>
            <div className="flex items-center h-11 px-3 bg-muted/40 border-2 border-border text-sm font-mono text-muted-foreground select-all">
              {user.email}
            </div>
          </div>

          {/* First + last name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="mono-label text-muted-foreground">First name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="mono-label text-muted-foreground">Last name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 h-11 px-6 bg-foreground text-background font-heading text-xs font-bold uppercase tracking-widest transition-colors hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </section>

      {/* Security block */}
      <section className="mb-10 border-t border-border pt-8">
        <h2 className="mono-label text-foreground mb-4">Security</h2>
        <button
          type="button"
          onClick={handleResetPassword}
          disabled={resetting}
          className="inline-flex items-center gap-2 h-11 px-5 border-2 border-foreground text-foreground font-heading text-xs font-bold uppercase tracking-widest hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
        >
          <KeyRound className="h-3.5 w-3.5" />
          {resetting ? "Sending…" : "Send password reset email"}
        </button>
        <p className="mt-2 text-xs text-muted-foreground">
          A reset link will be emailed to <span className="font-mono">{user.email}</span>.
        </p>
      </section>

      {/* Sign out block */}
      <section className="border-t-2 border-accent pt-8">
        <h2 className="mono-label text-accent mb-4">Session</h2>
        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex items-center gap-2 h-11 px-5 border-2 border-accent text-accent font-heading text-xs font-bold uppercase tracking-widest hover:bg-accent hover:text-white transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </section>
    </div>
  );
}
