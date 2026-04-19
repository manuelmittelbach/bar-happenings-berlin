import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { useAuth } from "@/hooks/useAuth";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? null;
  const fromEvent = from?.startsWith("/event/") ? from : null;
  const { signIn, signUp, resetPassword } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    const linkError = p.get("link_error");
    if (linkError === "reset") return "Your password reset link has expired. Please request a new one.";
    if (linkError === "confirm") return "Your confirmation link has expired. Please sign up again.";
    return "";
  });
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function friendlyError(msg: string): string {
    if (msg.includes("User already registered") || msg.includes("already been registered"))
      return "This email address is already in use.";
    if (msg.includes("Invalid login credentials") || msg.includes("invalid_credentials"))
      return "Wrong email or password. Please try again.";
    if (msg.includes("Email not confirmed"))
      return "Please confirm your email address first, then sign in.";
    if (msg.includes("rate limit") || msg.includes("over_email_send_rate_limit"))
      return "Too many attempts. Please wait a few minutes and try again.";
    return msg;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (isForgotPassword) {
        await resetPassword(email);
        setSuccess("Reset link sent! Check your inbox.");
      } else if (isLogin) {
        await signIn(email, password);
        navigate("/my-events");
      } else {
        await signUp(email, password, firstName, lastName);
        setSuccess("confirm-email");
      }
    } catch (err: unknown) {
      setError(friendlyError(err instanceof Error ? err.message : "Something went wrong"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {fromEvent ? (
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border flex items-center px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-base font-mono font-medium tracking-wide transition-colors focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>
        </div>
      ) : (
        <Header />
      )}
      <main className="flex-1 flex items-center justify-center py-16">
        <div className="w-full max-w-sm mx-auto px-4">
          {success === "confirm-email" ? (
            <div className="text-center space-y-4">
              <h1 className="heading-display text-2xl">Check your email</h1>
              <p className="text-sm text-muted-foreground">We sent a confirmation link to <strong>{email}</strong>. Please confirm your email address before signing in.</p>
              <button
                onClick={() => { setSuccess(""); setIsLogin(true); setPassword(""); }}
                className="w-full h-10 bg-foreground text-background rounded-sm text-sm font-semibold hover:bg-foreground/90 transition-colors"
              >
                Go to sign in
              </button>
            </div>
          ) : (
          <><div className="text-center mb-8">
            <h1 className="heading-display text-2xl">
              {isForgotPassword ? "Reset password" : isLogin ? "Welcome back" : "Create account"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isForgotPassword
                ? "We'll send you a link to reset your password"
                : isLogin
                ? "Sign in to see your saved events"
                : "Save events you're interested in"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && !isForgotPassword && (
              <div className="flex gap-2">
                <div className="flex-1 space-y-1.5">
                  <label className="text-sm font-medium">First name</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Anna"
                    className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="text-sm font-medium">Last name</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Müller"
                    className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
              />
            </div>

            {!isForgotPassword && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Password</label>
                  {(isLogin || error === "This email address is already in use.") && (
                    <button
                      type="button"
                      onClick={() => { setIsForgotPassword(true); setError(""); setSuccess(""); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 px-3 pr-10 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {success && (
              <p className="text-sm text-green-500 font-medium">{success}</p>
            )}
            {error && (
              <p className="text-sm text-accent font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-foreground text-background rounded-sm text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-60"
            >
              {loading ? "..." : isForgotPassword ? "Send reset link" : isLogin ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {isForgotPassword ? (
              <>
                Remember your password?{" "}
                <button
                  onClick={() => { setIsForgotPassword(false); setIsLogin(true); setError(""); setSuccess(""); }}
                  className="text-foreground font-medium hover:text-accent transition-colors"
                >
                  Sign in
                </button>
              </>
            ) : isLogin ? (
              <>
                Don't have an account?{" "}
                <button
                  onClick={() => { setIsLogin(false); setError(""); setSuccess(""); }}
                  className="text-foreground font-medium hover:text-accent transition-colors"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => { setIsLogin(true); setError(""); setSuccess(""); }}
                  className="text-foreground font-medium hover:text-accent transition-colors"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
          </>)}
        </div>
      </main>
      <Footer />
    </div>
  );
}
