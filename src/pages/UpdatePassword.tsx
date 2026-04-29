import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { PASSWORD_MIN_LENGTH } from "@/lib/passwordStrength";
import { markPasswordJustReset } from "@/lib/justConfirmed";

export default function UpdatePassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const hasRecoveryToken = hash.includes("type=recovery") || hash.includes("access_token=");

    if (!hasRecoveryToken) {
      setError("Invalid or expired reset link. Please request a new one.");
      return;
    }

    const timeout = setTimeout(() => {
      setError("Reset link could not be verified. Please request a new one.");
    }, 15000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        clearTimeout(timeout);
        setError("");
        setReady(true);
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      markPasswordJustReset();
      navigate("/profile", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center py-16">
      <div className="w-full max-w-sm mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="heading-display text-2xl">Set new password</h1>
            <p className="text-sm text-muted-foreground mt-1">Choose a new password for your account</p>
          </div>

          {!ready ? (
            error ? (
              <div className="text-center space-y-3">
                <p className="text-sm text-accent font-medium">{error}</p>
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="text-sm underline text-muted-foreground hover:text-foreground"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center">Verifying your reset link…</p>
            )
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">New password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    minLength={PASSWORD_MIN_LENGTH}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 px-3 pr-10 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    aria-label={showPass ? "Hide password" : "Show password"}
                    aria-pressed={showPass}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <PasswordStrengthMeter password={password} />
              </div>

              {error && <p className="text-sm text-accent font-medium">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-foreground text-background rounded-sm text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-60"
              >
                {loading ? "..." : "Update password"}
              </button>
            </form>
          )}
      </div>
    </div>
  );
}
