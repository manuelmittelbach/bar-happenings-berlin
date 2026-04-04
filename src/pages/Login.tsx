import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Mail, Lock } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { toast } from "sonner";

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success(isLogin ? "Welcome back!" : "Account created!", {
      description: "Redirecting to your dashboard...",
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center py-16">
        <div className="w-full max-w-sm mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="heading-display text-2xl">{isLogin ? "Welcome back" : "Create account"}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLogin ? "Sign in to manage your venue and events" : "Start publishing events on Tipsy Tiger"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Venue or organizer name</label>
                <input
                  type="text" required
                  placeholder="e.g. Kastanienbar"
                  className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@venue.com"
                  className="w-full h-10 pl-10 pr-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPass ? "text" : "password"} required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 pl-10 pr-10 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            <button type="submit" className="w-full h-10 bg-foreground text-background rounded-sm text-sm font-semibold hover:bg-foreground/90 transition-colors">
              {isLogin ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => setIsLogin(!isLogin)} className="text-foreground font-medium hover:text-accent transition-colors">
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
