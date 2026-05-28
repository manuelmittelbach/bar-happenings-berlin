import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Save, AtSign, CheckCircle2, Eye, EyeOff, AlertCircle, ChevronLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { fetchProfile, updateProfile, deleteAccount } from "@/lib/supabaseQueries";
import { supabase } from "@/integrations/supabase/client";
import { PageSpinner } from "@/components/ui/page-spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  consumeEmailJustChanged,
  clearEmailJustChangedSoon,
  EMAIL_CHANGE_KEY,
  consumePasswordJustReset,
  clearPasswordJustResetSoon,
  PASSWORD_RESET_KEY,
} from "@/lib/justConfirmed";

const inputClass =
  "w-full h-11 px-3 bg-background border-2 border-foreground font-serif text-base outline-none focus:bg-card transition-colors placeholder:text-foreground/30";

export default function ProfileDetails() {
  const navigate = useNavigate();
  const { user, role, approvalStatus, loading, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [emailJustChanged, setEmailJustChanged] = useState<boolean>(consumeEmailJustChanged);
  const [passwordJustReset, setPasswordJustReset] = useState<boolean>(consumePasswordJustReset);

  useEffect(() => {
    if (!emailJustChanged) return;
    return clearEmailJustChangedSoon();
  }, [emailJustChanged]);

  useEffect(() => {
    if (!passwordJustReset) return;
    return clearPasswordJustResetSoon();
  }, [passwordJustReset]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === EMAIL_CHANGE_KEY && e.newValue && consumeEmailJustChanged()) {
        setEmailJustChanged(true);
      }
      if (e.key === PASSWORD_RESET_KEY && e.newValue && consumePasswordJustReset()) {
        setPasswordJustReset(true);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);
  const [emailChangeRequested, setEmailChangeRequested] = useState(false);

  const userEmail = user?.email;
  useEffect(() => {
    if (!userEmail) return;
    if (consumeEmailJustChanged()) {
      setEmailJustChanged(true);
      setEmailChangeRequested(false);
    }
  }, [userEmail]);

  useEffect(() => {
    if (loading) return;
    // Open to every signed-in role (user, organizer, admin); only
    // unauthenticated visitors get redirected to the sign-in surface.
    if (!user) {
      navigate("/signin", { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchProfile(user.id)
      .then((p) => {
        if (p) {
          setFirstName(p.firstName);
          setLastName(p.lastName);
        }
        setInitialized(true);
      })
      .catch((err) => {
        console.error("[ProfileDetails] fetchProfile failed", err);
        setLoadError(true);
        setInitialized(true);
      });
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    if (!trimmedFirst || !trimmedLast) {
      toast.error("First and last name are required.");
      return;
    }
    setSaving(true);
    try {
      await updateProfile(user.id, { firstName: trimmedFirst, lastName: trimmedLast });
      toast.success("Profile updated.");
    } catch {
      toast.error("Couldn't save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) {
      toast.error("Please enter a new email address.");
      return;
    }
    if (trimmed === user.email.toLowerCase()) {
      toast.error("New email must differ from your current email.");
      return;
    }
    setChangingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("already") || msg.includes("registered") || msg.includes("taken")) {
          toast.error("This email address is already in use.");
        } else if (msg.includes("rate limit")) {
          toast.error("Too many attempts. Please wait a few minutes and try again.");
        } else {
          toast.error("Couldn't update email. Please try again.");
        }
        return;
      }
      setEmailChangeRequested(true);
      setNewEmail("");
      toast.success("Confirmation link sent to your new email.");
    } finally {
      setChangingEmail(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("New password must differ from current password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match.");
      return;
    }
    setChangingPassword(true);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyError) {
        toast.error("Current password is incorrect.");
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        toast.error("Couldn't update password. Please try again.");
        return;
      }
      await supabase.auth.signOut({ scope: "others" });
      void supabase.functions.invoke("notify-password-changed").catch(() => {
        // Notification email failure is non-fatal — password change already succeeded.
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated. Other devices have been signed out.");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      // The session is invalid once the user is gone — clear it locally and
      // ignore any sign-out error, then leave.
      await signOut().catch(() => {});
      toast.success("Your account has been deleted.");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete your account. Please try again.");
      setDeleting(false);
    }
  };

  if (loading || !user || !initialized) {
    return <PageSpinner />;
  }

  const showApprovalBadge = role === "organizer" && approvalStatus !== "approved";
  const approvalColor =
    approvalStatus === "rejected"
      ? "border-red-600/60 bg-red-500/10 text-red-700"
      : "border-yellow-600/60 bg-yellow-500/10 text-yellow-700";

  return (
    <div>
      {/* Back row — chevron-back pattern shared with the detail pages */}
      <div className="sticky z-40 bg-background" style={{ top: "var(--header-h)" }}>
        <div className="container flex items-center py-2">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 p-2 -ml-2 text-foreground active:opacity-60 hover:opacity-70 transition-opacity"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]">Back</span>
          </button>
        </div>
      </div>

      <div className="container max-w-2xl pb-10 md:pb-14 pt-4">
        {emailJustChanged && (
          <div className="mb-6 inline-flex items-center gap-2 border-2 border-foreground bg-green-500/10 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-green-700">
            <CheckCircle2 className="h-4 w-4" /> Email updated
          </div>
        )}
        {passwordJustReset && (
          <div className="mb-6 inline-flex items-center gap-2 border-2 border-foreground bg-green-500/10 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-green-700">
            <CheckCircle2 className="h-4 w-4" /> Password reset
          </div>
        )}
        {loadError && (
          <div className="mb-6 flex items-start gap-2 border-2 border-foreground bg-red-500/10 px-3 py-2 text-sm font-medium text-red-700">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>Couldn't load your profile data. Please refresh the page to try again.</span>
          </div>
        )}
        {/* Masthead — Bars-directory pattern: compact heading-display on
            a hairline rule. */}
        <header className="mb-8 md:mb-10">
          <div className="pt-2.5 pb-2.5 border-b-2 border-border">
            <h1 className="heading-display text-2xl md:text-[30px] leading-none m-0">Your profile</h1>
          </div>
        </header>

        {/* Identity block */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="mono-label text-foreground">Identity</h2>
          </div>

          {showApprovalBadge && (
            <div className={`mb-5 inline-flex items-center gap-2 border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${approvalColor}`}>
              {approvalStatus === "rejected" ? "Application not approved" : "Awaiting admin approval"}
            </div>
          )}

          {!loadError && (
            <form onSubmit={handleSave} className="space-y-5">
              {/* First + last name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="mono-label text-muted-foreground">First name</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="mono-label text-muted-foreground">Last name</label>
                  <input
                    type="text"
                    required
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
                  className="inline-flex items-center gap-2 h-11 px-6 bg-foreground text-background font-mono text-xs font-bold uppercase tracking-widest transition-colors hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Change email */}
        <section className="mt-10 border-t border-border pt-8">
          <h2 className="mono-label text-foreground mb-4">Change email</h2>
          <form onSubmit={handleChangeEmail} className="space-y-4">
            <div className="space-y-1.5">
              <label className="mono-label text-muted-foreground">Email</label>
              <div className="flex items-center h-11 px-3 bg-muted/40 border-2 border-foreground/40 text-sm font-mono text-muted-foreground select-all">
                {user.email}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="mono-label text-muted-foreground">New email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@example.com"
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground">
                We'll send a confirmation link to the new address. Your email won't change until you click it.
              </p>
            </div>
            {emailChangeRequested && (
              <p className="border-2 border-foreground bg-green-500/10 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-green-700">
                Confirmation link sent — check your new inbox
              </p>
            )}
            <div className="pt-1">
              <button
                type="submit"
                disabled={changingEmail}
                className="inline-flex items-center gap-2 h-11 px-6 bg-foreground text-background font-mono text-xs font-bold uppercase tracking-widest transition-colors hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <AtSign className="h-3.5 w-3.5" />
                {changingEmail ? "Sending…" : "Update email"}
              </button>
            </div>
          </form>
        </section>

        {/* Change password */}
        <section className="mt-10 border-t border-border pt-8">
          <h2 className="mono-label text-foreground mb-4">Change password</h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="mono-label text-muted-foreground">Current password</label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  aria-label={showCurrent ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="mono-label text-muted-foreground">New password</label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  aria-label={showNew ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <div className="space-y-1.5">
              <label className="mono-label text-muted-foreground">Confirm new password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="pt-1">
              <button
                type="submit"
                disabled={changingPassword}
                className="inline-flex items-center gap-2 h-11 px-6 bg-foreground text-background font-mono text-xs font-bold uppercase tracking-widest transition-colors hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <KeyRound className="h-3.5 w-3.5" />
                {changingPassword ? "Updating…" : "Update password"}
              </button>
            </div>
          </form>
        </section>

        {role !== "admin" && (
          <section className="mt-10 border-t-2 border-red-600/40 pt-8">
            <h2 className="mono-label text-red-700 mb-2">Danger zone</h2>
            <p className="text-sm text-muted-foreground mb-4 max-w-prose">
              Deleting your account is permanent and irreversible.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={deleting}
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-none border-2 border-red-600 text-red-700 font-mono text-xs font-bold uppercase tracking-widest hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deleting ? "Deleting…" : "Delete account"}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-none border-2 border-foreground">
                <AlertDialogHeader>
                  <AlertDialogTitle className="heading-display text-2xl">Delete account?</AlertDialogTitle>
                  <AlertDialogDescription className="text-sm text-muted-foreground">
                    This permanently deletes your account and cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-none border-2 border-foreground font-mono text-xs font-bold uppercase tracking-widest">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="rounded-none border-2 border-red-600 bg-red-600 text-white font-mono text-xs font-bold uppercase tracking-widest hover:bg-red-700"
                  >
                    Delete account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </section>
        )}
      </div>
    </div>
  );
}
