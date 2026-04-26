import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { deriveNeighborhood } from "@/lib/neighborhoodFromAddress";
import { fetchUserRole } from "@/lib/supabaseQueries";
import { Spinner } from "@/components/ui/spinner";
import { markEmailJustConfirmed } from "@/lib/justConfirmed";

type Role = "user" | "organizer" | "admin" | null;

function defaultTargetForRole(role: Role): string {
	if (role === "admin") return "/admin";
	if (role === "organizer") return "/dashboard";
	return "/my-events";
}

function resolvePostAuthTarget(from: string | null, role: Role): string {
	const fallback = defaultTargetForRole(role);
	if (!from) return fallback;
	if (from === "/login" || from === "/for-bars") return fallback;
	if (!from.startsWith("/")) return fallback;
	return from;
}

type VenueOption = { id: string; name: string };

const LOCKOUT_PREFIX = "inside-bars-lockout:";
const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

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
	const { user, role, loading: authLoading, roleResolved, signIn, signUp, resetPassword } = useAuth();

	const [isLogin, setIsLogin] = useState(() => {
		const p = new URLSearchParams(window.location.search);
		if (p.get("link_error") === "confirm") return false;
		return p.get("mode") !== "signup";
	});
	const [isForgotPassword, setIsForgotPassword] = useState(() => {
		const p = new URLSearchParams(window.location.search);
		return p.get("link_error") === "reset";
	});
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [isBarOwner] = useState(() => {
		const p = new URLSearchParams(window.location.search);
		return p.get("bar") === "1";
	});
	const [venueOptions, setVenueOptions] = useState<VenueOption[]>([]);
	const [selectedVenueId, setSelectedVenueId] = useState("");
	const [barNotInList, setBarNotInList] = useState(false);
	const [barName, setBarName] = useState("");
	const [barStreet, setBarStreet] = useState("");
	const [barPostalCode, setBarPostalCode] = useState("");
	const [barCity, setBarCity] = useState("");
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

	useEffect(() => {
		if (authLoading || !user || !roleResolved) return;
		if (success === "confirm-email") {
			markEmailJustConfirmed();
		}
		const target = resolvePostAuthTarget(from, role);
		navigate(target, { replace: true });
	}, [user, role, roleResolved, authLoading, from, navigate, success]);

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
		if (isLogin || isForgotPassword || !isBarOwner) return;
		if (venueOptions.length > 0) return;
		let cancelled = false;
		supabase
			.from("venues")
			.select("id, name")
			.order("name", { ascending: true })
			.then(({ data, error: venueErr }) => {
				if (cancelled || venueErr || !data) return;
				setVenueOptions(data as VenueOption[]);
			});
		return () => { cancelled = true; };
	}, [isLogin, isForgotPassword, isBarOwner, venueOptions.length]);

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
		if (msg.includes("weak_password") || msg.includes("Password should be"))
			return "Password is too weak. Please use at least 8 characters.";
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
				const userRole = signedInUser ? await fetchUserRole(signedInUser.id) : "user";
				const target = resolvePostAuthTarget(from, userRole);
				navigate(target);
			} else {
				let venuePayload: Parameters<typeof signUp>[5];
				if (isBarOwner) {
					if (barNotInList) {
						venuePayload = {
							name: barName,
							address: `${barStreet}, ${barPostalCode} ${barCity}`.trim(),
							neighborhood: deriveNeighborhood(barStreet, barPostalCode),
							website: barWebsite,
							instagram: barInstagram,
							phone: barPhone,
						};
					} else {
						venuePayload = {
							existingVenueId: selectedVenueId,
							website: barWebsite,
							instagram: barInstagram,
							phone: barPhone,
						};
					}
				}
				await signUp(email, password, firstName, lastName, isBarOwner, venuePayload);
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

	if (authLoading || user) {
		return (
			<div className="flex-1 flex items-center justify-center py-16">
				<Spinner />
			</div>
		);
	}

	return (
		<div className="flex-1 flex items-center justify-center py-16">
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
								{isForgotPassword ? "Reset password" : isLogin ? "Welcome back!" : "Welcome!"}
							</h1>
							<p className="text-sm text-muted-foreground mt-1">
								{isForgotPassword
									? "We'll send you a link to reset your password"
									: isLogin
										? "Sign in to save events"
										: isBarOwner
											? "Sign up to publish events"
											: "Sign up to save events"}
							</p>
						</div>

							<form onSubmit={handleSubmit} className="space-y-4">
								{!isLogin && !isForgotPassword && (
									<div className="flex gap-2">
										<div className="flex-1 space-y-1.5">
											<label className="text-sm font-medium">First name {isBarOwner && <span className="text-accent">*</span>}</label>
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
											<label className="text-sm font-medium">Last name {isBarOwner && <span className="text-accent">*</span>}</label>
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

								{!isLogin && !isForgotPassword && isBarOwner && (
									<>
										{!barNotInList && (
											<div className="space-y-1.5">
												<label className="text-sm font-medium">Bar name <span className="text-accent">*</span></label>
												<select
													required
													value={selectedVenueId}
													onChange={(e) => setSelectedVenueId(e.target.value)}
													className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
												>
													<option value="">Select your bar…</option>
													{venueOptions.map(v => (
														<option key={v.id} value={v.id}>{v.name}</option>
													))}
												</select>
											</div>
										)}

										<div className="flex items-center gap-2">
											<input
												id="barNotInList"
												type="checkbox"
												checked={barNotInList}
												onChange={(e) => {
													setBarNotInList(e.target.checked);
													if (e.target.checked) setSelectedVenueId("");
												}}
												className="h-4 w-4"
											/>
											<label htmlFor="barNotInList" className="text-sm font-medium cursor-pointer">
												Bar not in list
											</label>
										</div>

										{barNotInList && (
											<>
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
													<label className="text-sm font-medium">Street and house number <span className="text-accent">*</span></label>
													<input
														type="text"
														required
														value={barStreet}
														onChange={(e) => setBarStreet(e.target.value)}
														placeholder="Schönhauser Allee 12"
														className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
													/>
												</div>
												<div className="space-y-1.5">
													<label className="text-sm font-medium">Postal code <span className="text-accent">*</span></label>
													<input
														type="text"
														required
														value={barPostalCode}
														onChange={(e) => setBarPostalCode(e.target.value)}
														placeholder="10435"
														className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
													/>
													{barPostalCode.length === 5 && (
														<p className="text-xs text-muted-foreground">
															Neighborhood: {deriveNeighborhood(barStreet, barPostalCode) || "Unknown — please check"}
														</p>
													)}
												</div>
												<div className="space-y-1.5">
													<label className="text-sm font-medium">City <span className="text-accent">*</span></label>
													<input
														type="text"
														required
														value={barCity}
														onChange={(e) => setBarCity(e.target.value)}
														placeholder="Berlin"
														className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
													/>
												</div>
											</>
										)}
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
									</>
								)}

								<div className="space-y-1.5">
									<label className="text-sm font-medium">Email {!isLogin && !isForgotPassword && isBarOwner && <span className="text-accent">*</span>}</label>
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
											<label className="text-sm font-medium">Password {!isLogin && isBarOwner && <span className="text-accent">*</span>}</label>
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
												{...(!isLogin && { minLength: 8 })}
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
											onClick={() => {
												if (from === "/for-bars") {
													navigate("/for-bars", { state: { scrollToSignIn: true } });
													return;
												}
												setIsLogin(true); setError(""); setSuccess("");
											}}
											className="text-foreground font-medium hover:text-accent transition-colors"
										>
											Sign in
										</button>
									</>
								)}
							</p>
						</>)}
			</div>
		</div>
	);
}
