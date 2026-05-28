import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, ArrowRight, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsNative } from "@/hooks/useIsNative";

export default function ForBars() {
	const navigate = useNavigate();
	const location = useLocation();
	const { user, signIn, signOut, resetPassword } = useAuth();
	const isNative = useIsNative();
	// Bare sign-in (no marketing) on native apps, and on web when reached via
	// the header "Sign in" entry (/for-bars?view=signin).
	const bareSignIn = isNative || new URLSearchParams(location.search).get("view") === "signin";
	const [signingOut, setSigningOut] = useState(false);

	const handleSignOut = async () => {
		setSigningOut(true);
		try {
			await signOut();
		} finally {
			setSigningOut(false);
		}
	};

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
			{bareSignIn ? (
				/* ─── SIGN-IN ONLY (header icon + native apps) ─── */
				<section className="flex flex-1 items-center">
					<div className="w-full px-4 py-12 md:py-20">
						{user && !loading ? (
							<div className="max-w-sm mx-auto space-y-5">
								<div className="text-center">
									<h2 className="heading-display text-2xl">You're signed in</h2>
									<p className="text-sm text-muted-foreground mt-1 break-all">
										as <span className="font-mono">{user.email}</span>
									</p>
								</div>
								<button
									type="button"
									onClick={handleSignOut}
									disabled={signingOut}
									className="inline-flex w-full h-11 items-center justify-center gap-2 border-2 border-foreground text-foreground font-mono text-xs font-bold uppercase tracking-widest hover:bg-foreground hover:text-background transition-colors disabled:opacity-60"
								>
									<LogOut className="h-3.5 w-3.5" />
									{signingOut ? "Signing out…" : "Sign out to switch account"}
								</button>
							</div>
						) : (
							<>
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
													navigate("/login?mode=signup&bar=1", { state: { from: "/for-bars" } })
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
							</>
						)}
					</div>
				</section>
			) : (
				<>
					{/* ─── 1 · HERO ─────────────────────────────────────────────
					    Editorial title block with dotted-grid wash, mirroring
					    About + Contact. */}
					<section className="relative overflow-hidden border-b-2 border-foreground">
						<div
							aria-hidden
							className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05]"
							style={{
								backgroundImage:
									"linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
								backgroundSize: "48px 48px",
								maskImage:
									"radial-gradient(ellipse at 25% 50%, black 25%, transparent 80%)",
								WebkitMaskImage:
									"radial-gradient(ellipse at 25% 50%, black 25%, transparent 80%)",
							}}
						/>

						<div className="container relative px-4 py-16 md:py-24">
							<motion.h1
								initial={{ opacity: 0, y: 14 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.55, delay: 0.1 }}
								className="heading-display leading-[0.95]"
								style={{ fontSize: "clamp(36px, 5.6vw, 78px)" }}
							>
								Run a bar
								<br />
								<span className="heading-editorial italic lowercase font-light">in</span>{" "}
								Berlin
								<span className="text-accent">?</span>
							</motion.h1>

							<motion.p
								initial={{ opacity: 0, y: 12 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.5, delay: 0.18 }}
								className="mt-4 heading-editorial italic font-light text-foreground/55 leading-[1.2]"
								style={{ fontSize: "clamp(15px, 1.8vw, 22px)" }}
							>
								— or host a night in one?
							</motion.p>

							<motion.p
								initial={{ opacity: 0, y: 12 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.5, delay: 0.25 }}
								className="mt-8 max-w-xl text-balance text-lg leading-[1.5] text-foreground/75 md:text-xl"
							>
								Publish your events and reach people looking for something to do tonight.
							</motion.p>

							{user && !loading ? (
								<div className="mt-10 max-w-md border-l-2 border-foreground pl-4 py-2 space-y-2">
									<p className="text-sm">
										You're signed in as <strong className="font-mono">{user.email}</strong>.
									</p>
									<p className="text-sm text-muted-foreground leading-relaxed">
										Sign out to register a new bar account.
									</p>
									<button
										type="button"
										onClick={handleSignOut}
										disabled={signingOut}
										className="mt-1 inline-flex items-center gap-2 h-9 px-4 border-2 border-foreground text-foreground font-mono text-xs font-bold uppercase tracking-widest hover:bg-foreground hover:text-background transition-colors disabled:opacity-60"
									>
										<LogOut className="h-3.5 w-3.5" />
										{signingOut ? "Signing out…" : "Sign out"}
									</button>
								</div>
							) : (
								<motion.div
									initial={{ opacity: 0, y: 12 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.5, delay: 0.35 }}
									className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-7"
								>
									<button
										onClick={() =>
											navigate("/login?mode=signup&bar=1", { state: { from: "/for-bars" } })
										}
										className="group inline-flex items-center gap-2 h-12 px-6 border-2 border-foreground bg-foreground font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-background hover:bg-background hover:text-foreground active:scale-[0.98] transition-colors"
									>
										Create account
										<ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
									</button>
									<Link
										to="/for-bars?view=signin"
										className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/55 hover:text-foreground transition-colors"
									>
										Already have an account? Sign in →
									</Link>
								</motion.div>
							)}
						</div>
					</section>

					{/* ─── 2 · TWO WAYS IN ─────────────────────────────────────
					    Two-column editorial spread mirroring About's
					    problem/fix split. Left column = bar owners. Right
					    column = event hosts. 2px vertical rule between. */}
					<section className="relative">
						<div className="container relative grid grid-cols-1 gap-12 px-4 py-16 md:grid-cols-2 md:gap-0 md:py-24">
							<div
								aria-hidden
								className="pointer-events-none absolute left-1/2 top-12 bottom-12 hidden w-[2px] -translate-x-1/2 bg-foreground md:block"
							/>

							<article className="md:pr-10 lg:pr-16">
								<div className="mb-4 flex items-baseline gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">
									<span className="text-accent">01</span>
									For bar owners
								</div>
								<h2 className="heading-display text-3xl leading-[1.05] md:text-4xl">
									Claim your{" "}
									<span className="heading-editorial italic lowercase font-light">
										bar
									</span>
									<span className="text-accent">.</span>
								</h2>
								<p className="mt-5 text-[15px] leading-[1.65] text-foreground/75 md:text-base">
									Live music on weekends? Pub quiz on Tuesdays? List your bar and put your nights on the map.
								</p>
							</article>

							<article className="md:pl-10 lg:pl-16">
								<div className="mb-4 flex items-baseline gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">
									<span className="text-accent">02</span>
									For event hosts
								</div>
								<h2 className="heading-display text-3xl leading-[1.05] md:text-4xl">
									Host a{" "}
									<span className="heading-editorial italic lowercase font-light">
										night
									</span>
									<span className="text-accent">.</span>
								</h2>
								<p className="mt-5 text-[15px] leading-[1.65] text-foreground/75 md:text-base">
									DJing at a friend's bar? Running a pop-up? Publish it — no venue claim required.
								</p>
							</article>
						</div>
					</section>
				</>
			)}

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
