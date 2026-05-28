import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Eye, EyeOff, ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsNative } from "@/hooks/useIsNative";
import { supabase } from "@/integrations/supabase/client";
import { deriveNeighborhood } from "@/lib/neighborhoodFromAddress";
import { PageSpinner } from "@/components/ui/page-spinner";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { PASSWORD_MIN_LENGTH } from "@/lib/passwordStrength";

type VenueOption = { id: string; name: string };

/* Bar-owner signup. Reached from /for-organizers → "Create account". This page
 * is intentionally signup-only: signin, forgot-password, and signin lockout
 * all live on /for-organizers now that regular-user accounts no longer exist. The
 * `?bar=1` query param is no longer load-bearing — every visit to /login is
 * a bar-owner signup — but it stays in inbound URLs for backwards-compat. */
export default function Login() {
	const navigate = useNavigate();
	const location = useLocation();
	const from = (location.state as { from?: string })?.from ?? null;
	const { user, loading: authLoading, signUp } = useAuth();
	const isNative = useIsNative();

	const [isBarOwner, setIsBarOwner] = useState(false);
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
		if (authLoading || !user) return;
		if (from && from.startsWith("/") && from !== "/login" && from !== "/for-organizers") {
			navigate(from, { replace: true });
			return;
		}
		// After auth everyone lands on the account hub, regardless of role.
		navigate("/profile", { replace: true });
	}, [user, authLoading, from, navigate]);

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
			await signUp(email, password, firstName, lastName, isBarOwner, isBarOwner ? venuePayload : undefined);
			setSuccess(true);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Something went wrong";
			setError(friendlyError(message));
		} finally {
			setLoading(false);
		}
	};

	if (authLoading || user) {
		return <PageSpinner />;
	}

	if (success) {
		return (
			<div className="flex-1 flex items-center justify-center py-16">
				<div className="w-full max-w-sm mx-auto px-4 text-center space-y-4">
					<h1 className="heading-display text-2xl">Check your email</h1>
					<p className="text-sm text-muted-foreground">
						We sent a confirmation link to <strong>{email}</strong>. Please confirm your email address before signing in.
					</p>
					{isBarOwner && (
						<p className="text-sm text-muted-foreground">
							After confirming your email, an admin will review your bar details. You'll be able to publish events once your account is approved.
						</p>
					)}
					<button
						onClick={() => navigate("/for-organizers?view=signin")}
						className="w-full h-10 bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
					>
						Go to sign in
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col">
			{/* Layout mirrors the /for-organizers sign-in surface exactly — same
			    container, single centered section, and legal footer — so
			    "Create account" lands at the same height as "Welcome back!".
			    (The earlier absolute-back-button fix wasn't enough on its own:
			    without the footer below, this page centered in a taller box
			    and the heading sat lower.) */}
			<div className="container relative flex-1 flex flex-col md:flex-row md:items-stretch md:py-8">
			{/* Back — overlaid top-left so it doesn't push the form down. */}
			<button
				onClick={() => navigate(-1)}
				className="absolute left-4 top-3 inline-flex items-center gap-1 p-2 -ml-2 text-foreground active:opacity-60 hover:opacity-70 transition-opacity"
				aria-label="Back"
			>
				<ChevronLeft className="h-5 w-5" />
				<span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]">Back</span>
			</button>
			<section className="md:flex-1 md:flex md:items-center">
			<div className="w-full py-12 md:py-20 px-4">
				<div className="max-w-sm mx-auto text-center mb-8">
					<h1 className="heading-display text-2xl">Create account</h1>
					<p className="text-sm text-muted-foreground mt-1">Create your account</p>
				</div>

				<form onSubmit={handleSubmit} className="max-w-sm mx-auto space-y-4">
					{/* Bar-owner toggle — off = plain user account; on = organizer
					    (bar fields unlock, account goes through admin approval) */}
					<div className="flex items-center gap-2">
						<input
							id="isBarOwner"
							type="checkbox"
							checked={isBarOwner}
							onChange={(e) => setIsBarOwner(e.target.checked)}
							className="h-4 w-4"
						/>
						<label htmlFor="isBarOwner" className="text-sm font-medium cursor-pointer">
							I own or run a bar
						</label>
					</div>

					{/* Name — required for every account, bar owner or not. */}
					<div className="flex gap-2">
						<div className="flex-1 space-y-1.5">
							<label className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">First name <span className="text-accent">*</span></label>
							<input
								type="text"
								required
								autoComplete="given-name"
								value={firstName}
								onChange={(e) => setFirstName(e.target.value)}
								placeholder="Anna"
								className="w-full h-11 px-3 bg-background border-2 border-foreground font-serif text-base outline-none focus:bg-card transition-colors placeholder:text-foreground/30"
							/>
						</div>
						<div className="flex-1 space-y-1.5">
							<label className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">Last name <span className="text-accent">*</span></label>
							<input
								type="text"
								required
								autoComplete="family-name"
								value={lastName}
								onChange={(e) => setLastName(e.target.value)}
								placeholder="Smith"
								className="w-full h-11 px-3 bg-background border-2 border-foreground font-serif text-base outline-none focus:bg-card transition-colors placeholder:text-foreground/30"
							/>
						</div>
					</div>

					{isBarOwner && (
					<div className="border-l-2 border-foreground/30 pl-4 space-y-4">
					{!barNotInList && (
						<div className="space-y-1.5">
							<label className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">Bar name <span className="text-accent">*</span></label>
							<select
								required
								value={selectedVenueId}
								onChange={(e) => setSelectedVenueId(e.target.value)}
								className="w-full h-11 px-3 bg-background border-2 border-foreground font-serif text-base outline-none focus:bg-card transition-colors placeholder:text-foreground/30"
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
								<label className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">Bar name <span className="text-accent">*</span></label>
								<input
									type="text"
									required
									value={barName}
									onChange={(e) => setBarName(e.target.value)}
									placeholder="Zum Goldenen Hahn"
									className="w-full h-11 px-3 bg-background border-2 border-foreground font-serif text-base outline-none focus:bg-card transition-colors placeholder:text-foreground/30"
								/>
							</div>
							<div className="space-y-1.5">
								<label className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">Street and house number <span className="text-accent">*</span></label>
								<input
									type="text"
									required
									value={barStreet}
									onChange={(e) => setBarStreet(e.target.value)}
									placeholder="Schönhauser Allee 12"
									className="w-full h-11 px-3 bg-background border-2 border-foreground font-serif text-base outline-none focus:bg-card transition-colors placeholder:text-foreground/30"
								/>
							</div>
							<div className="space-y-1.5">
								<label className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">Postal code <span className="text-accent">*</span></label>
								<input
									type="text"
									required
									value={barPostalCode}
									onChange={(e) => setBarPostalCode(e.target.value)}
									placeholder="10435"
									className="w-full h-11 px-3 bg-background border-2 border-foreground font-serif text-base outline-none focus:bg-card transition-colors placeholder:text-foreground/30"
								/>
								{barPostalCode.length === 5 && (
									<p className="text-xs text-muted-foreground">
										Neighborhood: {deriveNeighborhood(barStreet, barPostalCode) || "Unknown — please check"}
									</p>
								)}
							</div>
							<div className="space-y-1.5">
								<label className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">City <span className="text-accent">*</span></label>
								<input
									type="text"
									required
									value={barCity}
									onChange={(e) => setBarCity(e.target.value)}
									placeholder="Berlin"
									className="w-full h-11 px-3 bg-background border-2 border-foreground font-serif text-base outline-none focus:bg-card transition-colors placeholder:text-foreground/30"
								/>
							</div>
						</>
					)}
					<div className="space-y-1.5">
						<label className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">Bar website</label>
						<input
							type="url"
							value={barWebsite}
							onChange={(e) => setBarWebsite(e.target.value)}
							placeholder="https://yourbar.de"
							className="w-full h-11 px-3 bg-background border-2 border-foreground font-serif text-base outline-none focus:bg-card transition-colors placeholder:text-foreground/30"
						/>
					</div>
					<div className="space-y-1.5">
						<label className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">Bar Instagram</label>
						<input
							type="text"
							value={barInstagram}
							onChange={(e) => setBarInstagram(e.target.value)}
							placeholder="@yourbar"
							className="w-full h-11 px-3 bg-background border-2 border-foreground font-serif text-base outline-none focus:bg-card transition-colors placeholder:text-foreground/30"
						/>
					</div>
					<div className="space-y-1.5">
						<label className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">Bar phone</label>
						<input
							type="tel"
							value={barPhone}
							onChange={(e) => setBarPhone(e.target.value)}
							placeholder="+49 30 123456"
							className="w-full h-11 px-3 bg-background border-2 border-foreground font-serif text-base outline-none focus:bg-card transition-colors placeholder:text-foreground/30"
						/>
					</div>
					</div>
					)}

					<div className="space-y-1.5">
						<label className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">Email <span className="text-accent">*</span></label>
						<input
							type="email"
							required
							autoComplete="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="you@example.com"
							className="w-full h-11 px-3 bg-background border-2 border-foreground font-serif text-base outline-none focus:bg-card transition-colors placeholder:text-foreground/30"
						/>
					</div>

					<div className="space-y-1.5">
						<label className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">Password <span className="text-accent">*</span></label>
						<div className="relative">
							<input
								type={showPass ? "text" : "password"}
								required
								autoComplete="new-password"
								minLength={PASSWORD_MIN_LENGTH}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="••••••••"
								className="w-full h-11 px-3 pr-10 bg-background border-2 border-foreground font-serif text-base outline-none focus:bg-card transition-colors placeholder:text-foreground/30"
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
						className="w-full h-11 border-2 border-foreground bg-foreground font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-background hover:bg-background hover:text-foreground active:scale-[0.98] transition-colors disabled:opacity-60"
					>
						{loading ? "..." : "Create account"}
					</button>
				</form>
			</div>
			</section>
			</div>
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
