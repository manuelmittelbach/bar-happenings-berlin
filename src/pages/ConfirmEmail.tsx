import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchUserRole } from "@/lib/supabaseQueries";
import { markEmailJustConfirmed } from "@/lib/justConfirmed";
import { Spinner } from "@/components/ui/spinner";

type Status = "idle" | "verifying" | "error";

type EmailOtpType = "email" | "signup" | "invite" | "magiclink" | "recovery" | "email_change";

const VALID_TYPES: ReadonlySet<EmailOtpType> = new Set([
  "email",
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
]);

function defaultTargetForRole(role: "user" | "organizer" | "admin"): string {
  if (role === "admin") return "/profile/admin";
  // Freshly-confirmed users and organizers land on their profile hub, not the
  // events list (organizers are still pending approval at this point anyway).
  return "/profile";
}

export default function ConfirmEmail() {
  const navigate = useNavigate();

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const tokenHash = params.get("token_hash");
  const typeParam = params.get("type");

  const type: EmailOtpType | null =
    typeParam && VALID_TYPES.has(typeParam as EmailOtpType) ? (typeParam as EmailOtpType) : null;

  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!tokenHash || !type) {
      setStatus("error");
      setErrorMessage("Confirmation link is missing required information.");
    }
  }, [tokenHash, type]);

  const handleConfirm = async () => {
    if (!tokenHash || !type) return;
    setStatus("verifying");
    setErrorMessage("");
    try {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) {
        setStatus("error");
        setErrorMessage(error.message || "Confirmation failed. Please try again.");
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const role = user ? await fetchUserRole(user.id) : "user";
      markEmailJustConfirmed();
      // Straight to the landing page — the green "Email confirmed" badge shows
      // there. No interstitial success screen (it only flashed for a frame).
      navigate(defaultTargetForRole(role), { replace: true });
    } catch (err) {
      setStatus("error");
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setErrorMessage(message);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center py-16">
      <div className="w-full max-w-md mx-auto px-4 text-center space-y-5">
        {status === "error" ? (
          <>
            <div className="flex justify-center">
              <XCircle className="h-10 w-10 text-accent" />
            </div>
            <h1 className="heading-display text-2xl">Confirmation failed</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">{errorMessage}</p>
            <button
              onClick={() => navigate("/signup", { replace: true })}
              className="inline-flex items-center gap-2 h-11 px-6 bg-foreground text-background font-body font-semibold text-sm hover:bg-foreground/90 transition-colors"
            >
              Back to bar signup
            </button>
          </>
        ) : status === "verifying" ? (
          <>
            <div className="flex justify-center"><Spinner /></div>
            <p className="text-sm text-muted-foreground leading-relaxed">Confirming your email…</p>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <Mail className="h-10 w-10 text-muted-foreground" />
            </div>
            <h1 className="heading-display text-2xl">Confirm your email</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Click the button below to confirm your email address and finish signing up.
            </p>
            <button
              onClick={handleConfirm}
              disabled={!tokenHash || !type}
              className="inline-flex items-center gap-2 h-11 px-6 bg-foreground text-background font-body font-semibold text-sm hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm email
            </button>
          </>
        )}
      </div>
    </div>
  );
}
