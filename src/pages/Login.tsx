import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { deriveNeighborhood } from "@/lib/neighborhoodFromAddress";
import { Spinner } from "@/components/ui/spinner";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { PASSWORD_MIN_LENGTH } from "@/lib/passwordStrength";

type Role = "user" | "organizer" | "admin" | null;

function defaultTargetForRole(role: Role): string {
	if (role === "admin") return "/admin";
	return "/dashboard";
}

type VenueOption = { id: string; name: string };

/* Bar-owner signup. Reached from /for-bars → "Create account". This page is
 * intentionally signup-only: signin, forgot-password, and signin lockout all
 * live on /for-bars now that regular-user accounts no longer exist. The
 * `?bar=1` query param is no longer load-bearing — every visit to /login is
 * a bar-owner signup — but it stays in inbound URLs for backwards-compat. */
export default function Login() {
	const navigate = useNavigate();
	const location = useLocation();
	const from = (location.state as { from?: string })?.from ?? null;
	const { user, role, loading: authLoading, roleResolved, signUp } = useAuth();

	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
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
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (authLoading || !user || !roleResolved) return;
		if (from && from.startsWith("/") && from !== "/login" && from !== "/for-bars") {
			navigate(from, { replace: true });
			return;
		}
		navigate(defaultTargetForRole(role), { replace: true });
	}, [user, role, roleResolved, authLoading, from, navigate]);

	useEffect(() => {
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
	}, []);

	function isNetworkError(msg: string): boolean {
		const m = msg.toLowerCase();
		return (
			m.includes("load failed") ||
			m.includes("failed to fetch") ||
			m.includes("networkerror") ||
			m.includes("network request failed") ||
			m.includes("network error")
		);
	}

	function friendlyError(msg: string): string {
		if (isNetworkError(msg)) {
			return "Couldn't reach our servers. Your account may still have been created — check your email for a confirmation link. If nothing arrives in a minute, please try again.";
		}
		if (msg.includes("User already registered") || msg.includes("already been registered"))
			return "This email address is already in use.";
		if (msg.includes("rate limit") || msg.includes("over_email_send_rate_limit"))
			return "Too many attempts. Please wait a few minutes and try again.";
		if (msg.includes("weak_password") || msg.includes("Password should be"))
			return "Password is too weak. Please use at least 8 characters.";
		return msg;
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const venuePayload = barNotInList
				? {
					name: barName,
					address: `${barStreet}, ${barPostalCode} ${barCity}`.trim(),
					neighborhood: deriveNeighborhood(barStreet, barPostalCode),
					website: barWebsite,
					instagram: barInstagram,
					phone: barPhone,
				}
				: {
					existingVenueId: selectedVenueId,
					website: barWebsite,
					instagram: barInstagram,
					phone: barPhone,
				};
			await signUp(email, password, firstName, lastName, true, venuePayload);
			setSuccess(true);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Something went wrong";
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

	if (success) {
		return (
			<div className="flex-1 flex items-center justify-center py-16">
				<div className="w-full max-w-sm mx-auto px-4 text-center space-y-4">
					<h1 className="heading-display text-2xl">Check your email</h1>
					<p className="text-sm text-muted-foreground">
						We sent a confirmation link to <strong>{email}</strong>. Please confirm your email address before signing in.
					</p>
					<p className="text-sm text-muted-foreground">
						After confirming your email, an admin will review your bar details. You'll be able to publish events once your account is approved.
					</p>
					<button
						onClick={() => navigate("/for-bars", { state: { scrollToSignIn: true } })}
						className="w-full h-10 bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
					>
						Go to sign in
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 flex items-center justify-center py-16">
			<div className="w-full max-w-sm mx-auto px-4">
				<div className="text-center mb-8">
					<h1 className="heading-display text-2xl">Create account</h1>
					<p className="text-sm text-muted-foreground mt-1">Sign up to publish events</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="flex gap-2">
						<div className="flex-1 space-y-1.5">
							<label className="text-sm font-medium">First name <span className="text-accent">*</span></label>
							<input
								type="text"
								required
								autoComplete="given-name"
								value={firstName}
								onChange={(e) => setFirstName(e.target.value)}
								placeholder="Anna"
								className="w-full h-10 px-3 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:border-foreground transition-colors"
							/>
						</div>
						<div className="flex-1 space-y-1.5">
							<label className="text-sm font-medium">Last name <span className="text-accent">*</span></label>
							<input
								type="text"
								required
								autoComplete="family-name"
								value={lastName}
								onChange={(e) => setLastName(e.target.value)}
								placeholder="Müller"
								className="w-full h-10 px-3 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:border-foreground transition-colors"
							/>
						</div>
					</div>

					{!barNotInList && (
						<div className="space-y-1.5">
							<label className="text-sm font-medium">Bar name <span className="text-accent">*</span></label>
							<select
								required
								value={selectedVenueId}
								onChange={(e) => setSelectedVenueId(e.target.value)}
								className="w-full h-10 px-3 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:border-foreground transition-colors"
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
									className="w-full h-10 px-3 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:border-foreground transition-colors"
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
									className="w-full h-10 px-3 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:border-foreground transition-colors"
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
									className="w-full h-10 px-3 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:border-foreground transition-colors"
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
									className="w-full h-10 px-3 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:border-foreground transition-colors"
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
							className="w-full h-10 px-3 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:border-foreground transition-colors"
						/>
					</div>
					<div className="space-y-1.5">
						<label className="text-sm font-medium">Instagram</label>
						<input
							type="text"
							value={barInstagram}
							onChange={(e) => setBarInstagram(e.target.value)}
							placeholder="@yourbar"
							className="w-full h-10 px-3 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:border-foreground transition-colors"
						/>
					</div>
					<div className="space-y-1.5">
						<label className="text-sm font-medium">Phone</label>
						<input
							type="tel"
							value={barPhone}
							onChange={(e) => setBarPhone(e.target.value)}
							placeholder="+49 30 123456"
							className="w-full h-10 px-3 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:border-foreground transition-colors"
						/>
					</div>

					<div className="space-y-1.5">
						<label className="text-sm font-medium">Email <span className="text-accent">*</span></label>
						<input
							type="email"
							required
							autoComplete="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="you@example.com"
							className="w-full h-10 px-3 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:border-foreground transition-colors"
						/>
					</div>

					<div className="space-y-1.5">
						<label className="text-sm font-medium">Password <span className="text-accent">*</span></label>
						<div className="relative">
							<input
								type={showPass ? "text" : "password"}
								required
								autoComplete="new-password"
								minLength={PASSWORD_MIN_LENGTH}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="••••••••"
								className="w-full h-10 px-3 pr-10 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:border-foreground transition-colors"
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
						className="w-full h-10 bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-60"
					>
						{loading ? "..." : "Create account"}
					</button>
				</form>

				<p className="text-center text-sm text-muted-foreground mt-6">
					Already have an account?{" "}
					<button
						onClick={() => navigate("/for-bars", { state: { scrollToSignIn: true } })}
						className="text-foreground font-medium hover:text-accent transition-colors"
					>
						Sign in
					</button>
				</p>
			</div>
		</div>
	);
}
