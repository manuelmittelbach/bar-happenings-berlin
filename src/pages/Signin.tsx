import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsNative } from "@/hooks/useIsNative";

// Dedicated sign-in surface. Reached from the header User icon, from "Already
// have an account? Sign in" on /for-organizers, and from various unauth
// guards. Signed-in users are bounced to /profile so this page is strictly
// for signing in (the "you're signed in"-fallback the old bareSignIn flow
// had is unnecessary here).
export default function Signin() {
	const navigate = useNavigate();
	const { user, loading: authLoading, signIn, resetPassword } = useAuth();
	const isNative = useIsNative();

	useEffect(() => {
		if (!authLoading && user) navigate("/profile", { replace: true });
	}, [user, authLoading, navigate]);

	const [isForgotPassword, setIsForgotPassword] = useState(false);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPass, setShowPass] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(() => {
		const p = new URLSearchParams(window.location.search);
		if (p.get("link_error") === "confirm") {
			return "Your confirmation link couldn't be verified. Please sign up again.";
		}
		if (p.get("link_error") === "reset") {
			return "Your reset link couldn't be verified. Please request a new one.";
		}
		return "";
	});
	const [success, setSuccess] = useState("");

	function friendlyError(msg: string): string {
		if (msg.includes("Invalid login credentials") || msg.includes("invalid_credentials")) {
			return "Wrong email or password. Please try again.";
		}
		if (msg.includes("Email not confirmed")) {
			return "Please confirm your email address first, then sign in.";
		}
		if (msg.includes("rate limit") || msg.includes("over_email_send_rate_limit")) {
			return "Too many attempts. Please wait a few minutes and try again.";
		}
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
				setSuccess("Reset link sent — check your inbox.");
			} else {
				await signIn(email, password);
				navigate("/profile");
			}
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Something went wrong";
			setError(friendlyError(message));
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex flex-1 flex-col bg-background">
			<section className="flex flex-1 items-center">
				<div className="w-full px-4 py-12 md:py-20">
					<div className="max-w-sm mx-auto text-center mb-8">
						<h2 className="heading-display text-2xl">
							{isForgotPassword ? "Reset password" : "Welcome back!"}
						</h2>
						<p className="text-sm text-muted-foreground mt-1">
							{isForgotPassword
								? "We'll send you a link to reset your password"
								: "Sign in to publish events"}
						</p>
					</div>

					<form onSubmit={handleSubmit} className="max-w-sm mx-auto space-y-4">
						<div className="space-y-1.5">
							<label className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">Email</label>
							<input
								type="email"
								required
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="you@example.com"
								className="w-full h-11 px-3 bg-background border-2 border-foreground font-serif text-base outline-none focus:bg-card transition-colors placeholder:text-foreground/30"
							/>
						</div>

						{!isForgotPassword && (
							<div className="space-y-1.5">
								<label className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">Password</label>

								<div className="relative">
									<input
										type={showPass ? "text" : "password"}
										required
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										placeholder="••••••••"
										className="w-full h-11 px-3 pr-10 bg-background border-2 border-foreground font-serif text-base outline-none focus:bg-card transition-colors placeholder:text-foreground/30"
									/>
									<button
										type="button"
										onClick={() => setShowPass((s) => !s)}
										className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
										aria-label={showPass ? "Hide password" : "Show password"}
									>
										{showPass ? (
											<EyeOff className="h-4 w-4" />
										) : (
											<Eye className="h-4 w-4" />
										)}
									</button>
								</div>
								<div className="flex justify-end">
									<button
										type="button"
										onClick={() => {
											setIsForgotPassword(true);
											setError("");
											setSuccess("");
										}}
										className="text-xs text-muted-foreground hover:text-foreground transition-colors"
									>
										Forgot password?
									</button>
								</div>
							</div>
						)}

						{success && <p className="text-sm text-green-500 font-medium">{success}</p>}
						{error && <p className="text-sm text-accent font-medium">{error}</p>}

						<button
							type="submit"
							disabled={loading}
							className="w-full h-11 border-2 border-foreground bg-foreground font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-background hover:bg-background hover:text-foreground active:scale-[0.98] transition-colors disabled:opacity-60"
						>
							{loading ? "..." : isForgotPassword ? "Send reset link" : "Sign in"}
						</button>

						{!isForgotPassword && (
							<p className="text-center text-sm text-muted-foreground pt-2">
								New here?{" "}
								<button
									type="button"
									onClick={() =>
										navigate("/signup", { state: { from: "/signin" } })
									}
									className="text-foreground font-medium hover:text-accent transition-colors"
								>
									Create account
								</button>
							</p>
						)}

						{isForgotPassword && (
							<p className="text-center text-sm text-muted-foreground pt-2">
								Remember your password?{" "}
								<button
									type="button"
									onClick={() => {
										setIsForgotPassword(false);
										setError("");
										setSuccess("");
									}}
									className="text-foreground font-medium hover:text-accent transition-colors"
								>
									Sign in
								</button>
							</p>
						)}
					</form>
				</div>
			</section>

			{isNative && (
				<nav
					aria-label="Legal"
					className="border-t-2 border-foreground/10 px-4 py-6 flex flex-wrap justify-center gap-x-6 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
				>
					<Link to="/impressum" className="hover:text-foreground transition-colors">
						Impressum
					</Link>
					<Link to="/datenschutz" className="hover:text-foreground transition-colors">
						Datenschutz
					</Link>
				</nav>
			)}
		</div>
	);
}
