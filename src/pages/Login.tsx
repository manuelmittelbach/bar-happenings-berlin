import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { useAuth } from "@/hooks/useAuth";
import { neighborhoods } from "@/data/mockData";
import { supabase } from "@/integrations/supabase/client";

const LOCKOUT_PREFIX = "inside-bars-lockout:";
const LOCKOUT_MS = 5 * 60 * 1000;
const MAX_FAILURES = 3;

type LockoutEntry = { failures: number; lockedUntil: number | null };

function readLockout(email: string): LockoutEntry {
  if (!email) return { failures: 0, lockedUntil: null };
  try {
    const raw = localStorage.getItem(LOCKOUT_PREFIX + email.toLowerCase());
    if (!raw) return { failures: 0, lockedUntil: null };
    const parsed = JSON.parse(raw) as LockoutEntry;
    return { failures: parsed.failures ?? 0, lockedUntil: parsed.lockedUntil ?? null };
  } catch {
    return { failures: 0, lockedUntil: null };
  }
}

function writeLockout(email: string, entry: LockoutEntry) {
  localStorage.setItem(LOCKOUT_PREFIX + email.toLowerCase(), JSON.stringify(entry));
}

function clearLockout(email: string) {
  localStorage.removeItem(LOCKOUT_PREFIX + email.toLowerCase());
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? null;
  const fromMyEvents = from === "/my-events" || from?.startsWith("/event/") === true;
  const { signIn, signUp, resetPassword } = useAuth();

  const [isLogin, setIsLogin] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("mode") !== "signup";
  });
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isBarOwner, setIsBarOwner] = useState(false);
  const [barName, setBarName] = useState("");
  const [barAddress, setBarAddress] = useState("");
  const [barNeighborhood, setBarNeighborhood] = useState("");
  const [barWebsite, setBarWebsite] = useState("");
  const [barInstagram, setBarInstagram] = useState("");
  const [barPhone, setBarPhone] = useState("");
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
  const [lockedUntil, setLockedUntil] = useState<number | null>(() => {
    const entry = readLockout(email);
    return entry.lockedUntil && entry.lockedUntil > Date.now() ? entry.lockedUntil : null;
  });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const entry = readLockout(email);
    setLockedUntil(entry.lockedUntil && entry.lockedUntil > Date.now() ? entry.lockedUntil : null);
  }, [email]);

  useEffect(() => {
    if (!lockedUntil) return;
    setNow(Date.now());
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= lockedUntil) {
        clearLockout(email);
        setLockedUntil(null);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lockedUntil, email]);

  const remaining = lockedUntil ? lockedUntil - now : 0;
  const isLocked = isLogin && !isForgotPassword && remaining > 0;

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

    if (isLogin && !isForgotPassword) {
      const entry = readLockout(email);
      if (entry.lockedUntil && entry.lockedUntil > Date.now()) {
        setLockedUntil(entry.lockedUntil);
        return;
      }
    }

    setLoading(true);

    try {
      if (isForgotPassword) {
        await resetPassword(email);
        setSuccess("Reset link sent! Check your inbox.");
      } else if (isLogin) {
        const { user: signedInUser } = await signIn(email, password);
        clearLockout(email);
        setLockedUntil(null);
        let role: string | null = null;
        if (signedInUser) {
          const { data } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", signedInUser.id)
            .maybeSingle();
          role = data?.role ?? null;
        }
        navigate(role === "admin" ? "/admin" : role === "organizer" ? "/dashboard" : "/my-events");
      } else {
        await signUp(email, password, firstName, lastName, isBarOwner, isBarOwner ? { name: barName, address: barAddress, neighborhood: barNeighborhood, website: barWebsite, instagram: barInstagram, phone: barPhone } : undefined);
        setSuccess("confirm-email");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      const isCredentialError = message.includes("Invalid login credentials") || message.includes("invalid_credentials");
      if (isLogin && !isForgotPassword && isCredentialError) {
        const entry = readLockout(email);
        const failures = entry.failures + 1;
        if (failures >= MAX_FAILURES) {
          const until = Date.now() + LOCKOUT_MS;
          writeLockout(email, { failures: 0, lockedUntil: until });
          setLockedUntil(until);
        } else {
          writeLockout(email, { failures, lockedUntil: null });
        }
      }
      setError(friendlyError(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center py-16">
        <div className="w-full max-w-sm mx-auto px-4">
          {success === "confirm-email" ? (
            <div className="text-center space-y-4">
              <h1 className="heading-display text-2xl">Check your email</h1>
              <p className="text-sm text-muted-foreground">We sent a confirmation link to <strong>{email}</strong>. Please confirm your email address before signing in.</p>
              {isBarOwner && (
                <p className="text-sm text-muted-foreground">
                  After confirming your email, an admin will review your bar details. You'll be able to publish events once your account is approved.
                </p>
              )}
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
                ? fromMyEvents ? "Sign in to save events and publish your own." : "Sign in to see your saved events"
                : "Sign up to save events and publish your own"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && !isForgotPassword && (
              <div className="flex gap-2">
                <div className="flex-1 space-y-1.5">
                  <label className="text-sm font-medium">First name <span className="text-accent">*</span></label>
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
                  <label className="text-sm font-medium">Last name <span className="text-accent">*</span></label>
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

            {!isLogin && !isForgotPassword && (
              <>
                <button
                  type="button"
                  onClick={() => setIsBarOwner(!isBarOwner)}
                  className={`w-full h-11 border-2 font-heading text-xs font-bold uppercase tracking-widest transition-colors ${
                    isBarOwner
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  }`}
                >
                  {isBarOwner ? "✓ I run a bar or venue" : "I run a bar or venue"}
                </button>
                {isBarOwner && (
                  <div className="space-y-3 border-l-2 border-foreground pl-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Bar name <span className="text-accent">*</span></label>
                      <input
                        type="text"
                        required
                        value={barName}
                        onChange={(e) => setBarName(e.target.value)}
                        placeholder="Zum Goldenen Hahn"
                        className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Address <span className="text-accent">*</span></label>
                      <input
                        type="text"
                        required
                        value={barAddress}
                        onChange={(e) => setBarAddress(e.target.value)}
                        placeholder="Schönhauser Allee 12, 10435 Berlin"
                        className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Neighborhood <span className="text-accent">*</span></label>
                      <select
                        required
                        value={barNeighborhood}
                        onChange={(e) => setBarNeighborhood(e.target.value)}
                        className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                      >
                        <option value="">Select neighborhood…</option>
                        {neighborhoods.map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Website</label>
                      <input
                        type="url"
                        value={barWebsite}
                        onChange={(e) => setBarWebsite(e.target.value)}
                        placeholder="https://yourbar.de"
                        className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Instagram</label>
                      <input
                        type="text"
                        value={barInstagram}
                        onChange={(e) => setBarInstagram(e.target.value)}
                        placeholder="@yourbar"
                        className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Phone</label>
                      <input
                        type="tel"
                        value={barPhone}
                        onChange={(e) => setBarPhone(e.target.value)}
                        placeholder="+49 30 123456"
                        className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email {!isLogin && !isForgotPassword && <span className="text-accent">*</span>}</label>
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
                  <label className="text-sm font-medium">Password {!isLogin && <span className="text-accent">*</span>}</label>
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
            {isLocked && (
              <p className="text-sm text-accent font-medium">
                Too many failed attempts. Try again in {formatCountdown(remaining)}.
              </p>
            )}
            {error && !isLocked && (
              <p className="text-sm text-accent font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || isLocked}
              className="w-full h-10 bg-foreground text-background rounded-sm text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-60"
            >
              {loading
                ? "..."
                : isLocked
                ? `Try again in ${formatCountdown(remaining)}`
                : isForgotPassword
                ? "Send reset link"
                : isLogin
                ? "Sign in"
                : "Create account"}
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
