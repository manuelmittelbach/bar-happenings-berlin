import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { useAuth } from "@/hooks/useAuth";

const benefits = [
	{ num: "01", label: "Fill the room" },
	{ num: "02", label: "Track interest" },
	{ num: "03", label: "2-min setup" },
];

export default function ForBars() {
	const navigate = useNavigate();
	const location = useLocation();
	const signInRef = useRef<HTMLElement>(null);
	const { signIn, resetPassword } = useAuth();

	useEffect(() => {
		if ((location.state as { scrollToSignIn?: boolean } | null)?.scrollToSignIn) {
			requestAnimationFrame(() => {
				signInRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
			});
			window.history.replaceState({}, "");
		}
	}, [location.state]);

	const [isForgotPassword, setIsForgotPassword] = useState(false);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPass, setShowPass] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
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
				const { user } = await signIn(email, password);
				const metaRole = user?.user_metadata?.role;
				navigate(metaRole === "organizer" ? "/dashboard" : "/my-events");
			}
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Something went wrong";
			setError(friendlyError(message));
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex flex-col">
			<Header />

			<main className="flex-1 bg-muted/40 flex">
				<div className="container relative flex-1 flex flex-col md:flex-row md:items-stretch md:py-8">
					<div className="hidden md:block pointer-events-none absolute top-8 bottom-8 left-1/2 -translate-x-1/2 w-[2px] bg-foreground" />

					{/* Hero / Create account */}
					<section className="md:flex-1">
						<div className="px-4 md:pl-0 md:pr-8 lg:pr-12 py-12 md:py-20 border-b-2 md:border-b-0 border-foreground">
							<h1 className="heading-display text-4xl md:text-5xl leading-[0.95]">
								Run a bar
								<br />
								<span className="heading-editorial italic lowercase font-light">in</span>{" "}
								Berlin
								<span className="text-accent">?</span>
							</h1>

							<p className="mt-6 text-base md:text-lg text-muted-foreground leading-relaxed max-w-md">
								Publish your events and reach locals looking for something to do tonight.
							</p>

							<button
								onClick={() =>
									navigate("/login?mode=signup&bar=1", { state: { from: "/for-bars" } })
								}
								className="group mt-8 inline-flex items-center gap-2 h-11 px-6 bg-foreground text-background font-body font-semibold text-sm hover:bg-foreground/90 transition-colors"
							>
								Create account
								<ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
							</button>

							<ul className="mt-12 grid grid-cols-3 gap-3 md:gap-6">
								{benefits.map((b) => (
									<li
										key={b.num}
										className="border-t border-border pt-3 flex flex-col gap-1.5"
									>
										<span className="font-mono text-[10px] tracking-widest text-accent">
											{b.num}
										</span>
										<span className="font-heading font-bold uppercase tracking-tight text-xs md:text-sm leading-tight">
											{b.label}
										</span>
									</li>
								))}
							</ul>
						</div>
					</section>

					{/* Sign in */}
					<section ref={signInRef} className="md:flex-1 md:flex md:items-center">
						<div className="w-full px-4 md:pl-8 md:pr-0 lg:pl-12 py-12 md:py-20">
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
									</div>
								)}

								{success && <p className="text-sm text-green-500 font-medium">{success}</p>}
								{error && <p className="text-sm text-accent font-medium">{error}</p>}

								<button
									type="submit"
									disabled={loading}
									className="w-full h-10 bg-foreground text-background rounded-sm text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-60"
								>
									{loading ? "..." : isForgotPassword ? "Send reset link" : "Sign in"}
								</button>

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
				</div>
			</main>

			<Footer />
		</div>
	);
}