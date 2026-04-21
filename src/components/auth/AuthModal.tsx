import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";

interface AuthModalProps {
  open: boolean;
  defaultTab?: "signup" | "login";
  onAuthenticated: () => void;
  onClose: () => void;
}

export default function AuthModal({ open, defaultTab = "signup", onAuthenticated, onClose }: AuthModalProps) {
  const [tab, setTab] = useState<"signup" | "login">(defaultTab);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { signUp, signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (tab === "signup") {
        await signUp(email, password, firstName, lastName);
      } else {
        await signIn(email, password);
      }
      onAuthenticated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (newTab: "signup" | "login") => {
    setTab(newTab);
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-background border-border p-0 overflow-hidden">
        <div className="flex">
          {/* Left panel — form */}
          <div className="flex-1 p-6">
            <DialogTitle className="font-body text-xl font-extrabold leading-tight mb-1">
              {tab === "signup" ? "Save events you love." : "Welcome back."}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mb-5">
              {tab === "signup"
                ? "Sign up to save events"
                : "Sign in to save events"}
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              {tab === "signup" && (
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      First name <span className="text-accent">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full h-10 px-3 bg-muted/40 border border-border rounded-md text-sm outline-none focus:border-accent transition-colors"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Last name <span className="text-accent">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full h-10 px-3 bg-muted/40 border border-border rounded-md text-sm outline-none focus:border-accent transition-colors"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Email <span className="text-accent">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 px-3 bg-muted/40 border border-border rounded-md text-sm outline-none focus:border-accent transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Password <span className="text-accent">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-10 px-3 pr-10 bg-muted/40 border border-border rounded-md text-sm outline-none focus:border-accent transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-xs text-accent font-medium">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-accent text-accent-foreground font-body font-bold uppercase tracking-wider text-sm rounded-full transition-opacity disabled:opacity-60 mt-1"
              >
                {loading ? "..." : tab === "signup" ? "Create account" : "Sign in"}
              </button>
            </form>
          </div>

          {/* Right panel — switch tab */}
          <div className="w-36 border-l border-border flex flex-col items-center justify-center p-4 gap-3">
            <p className="text-sm font-bold text-center leading-tight">
              {tab === "signup" ? "Already have an account?" : "New here?"}
            </p>
            <button
              onClick={() => switchTab(tab === "signup" ? "login" : "signup")}
              className="px-4 py-2 rounded-full border-2 border-accent text-accent text-xs font-bold uppercase tracking-wider hover:bg-accent/10 transition-colors"
            >
              {tab === "signup" ? "Sign in" : "Sign up"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
