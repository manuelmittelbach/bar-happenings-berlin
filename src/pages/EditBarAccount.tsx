import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
	clearVenueClaimProposals,
	fetchOrganizerById,
	updateOrganizerAccount,
	updatePendingBarSubmission,
	updateProfile,
} from "@/lib/supabaseQueries";
import { deriveNeighborhoodFromAddress } from "@/lib/neighborhoodFromAddress";
import { geocodeAddress } from "@/lib/geocoding";
import { PageSpinner } from "@/components/ui/page-spinner";

type EditMode = "venue" | "pending" | "claim";

export default function EditBarAccount() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const location = useLocation();
	const returnPath =
		(location.state as { returnPath?: string } | null)?.returnPath ?? "/admin";
	const { role, loading: authLoading, roleResolved } = useAuth();
	const [submitting, setSubmitting] = useState(false);
	const [geocoding, setGeocoding] = useState(false);
	const [notFound, setNotFound] = useState(false);
	const [mode, setMode] = useState<EditMode | null>(null);
	const [venueId, setVenueId] = useState<string | null>(null);
	const [email, setEmail] = useState<string | null>(null);
	const [existingNeighborhood, setExistingNeighborhood] = useState("");
	const [form, setForm] = useState({
		firstName: "",
		lastName: "",
		barName: "",
		barAddress: "",
		barWebsite: "",
		barInstagram: "",
		barPhone: "",
		barLat: "",
		barLng: "",
	});

	useEffect(() => {
		if (authLoading || !roleResolved) return;
		if (role !== "admin") {
			navigate("/", { replace: true });
			return;
		}
		if (!id) return;
		fetchOrganizerById(id)
			.then((organizer) => {
				if (!organizer) {
					setNotFound(true);
					return;
				}
				setEmail(organizer.email);
				if (organizer.venue) {
					setMode("venue");
					setVenueId(organizer.venue.id);
					setExistingNeighborhood(organizer.venue.neighborhood);
					setForm({
						firstName: organizer.firstName,
						lastName: organizer.lastName,
						barName: organizer.venue.name,
						barAddress: organizer.venue.address,
						barWebsite: organizer.venue.website ?? "",
						barInstagram: organizer.venue.instagram ?? "",
						barPhone: organizer.venue.phone ?? "",
						barLat: String(organizer.venue.lat),
						barLng: String(organizer.venue.lng),
					});
				} else if (organizer.pendingSubmission) {
					setMode("pending");
					setExistingNeighborhood(organizer.pendingSubmission.neighborhood);
					setForm({
						firstName: organizer.firstName,
						lastName: organizer.lastName,
						barName: organizer.pendingSubmission.name,
						barAddress: organizer.pendingSubmission.address,
						barWebsite: organizer.pendingSubmission.website ?? "",
						barInstagram: organizer.pendingSubmission.instagram ?? "",
						barPhone: organizer.pendingSubmission.phone ?? "",
						barLat: organizer.pendingSubmission.lat == null ? "" : String(organizer.pendingSubmission.lat),
						barLng: organizer.pendingSubmission.lng == null ? "" : String(organizer.pendingSubmission.lng),
					});
				} else if (organizer.pendingClaim) {
					setMode("claim");
					setVenueId(organizer.pendingClaim.venueId);
					setExistingNeighborhood(organizer.pendingClaim.venueNeighborhood);
					setForm({
						firstName: organizer.firstName,
						lastName: organizer.lastName,
						barName: organizer.pendingClaim.venueName,
						barAddress: organizer.pendingClaim.venueAddress,
						barWebsite: organizer.pendingClaim.proposedWebsite ?? organizer.pendingClaim.venueWebsite ?? "",
						barInstagram: organizer.pendingClaim.proposedInstagram ?? organizer.pendingClaim.venueInstagram ?? "",
						barPhone: organizer.pendingClaim.proposedPhone ?? organizer.pendingClaim.venuePhone ?? "",
						barLat: "",
						barLng: "",
					});
				} else {
					setNotFound(true);
				}
			})
			.catch(() => setNotFound(true));
	}, [id, role, authLoading, roleResolved, navigate]);

	const update = (field: keyof typeof form, value: string) =>
		setForm((prev) => ({ ...prev, [field]: value }));

	const derivedNeighborhood = useMemo(
		() => deriveNeighborhoodFromAddress(form.barAddress),
		[form.barAddress],
	);

	const parseCoord = (s: string, range: number): number | null => {
		const trimmed = s.trim();
		if (!trimmed) return null;
		const n = Number(trimmed);
		if (!Number.isFinite(n) || n < -range || n > range) return null;
		return n;
	};

	const handleGeocode = async () => {
		const address = form.barAddress.trim();
		if (!address) {
			toast.error("Please enter an address first.");
			return;
		}
		setGeocoding(true);
		try {
			const result = await geocodeAddress(address);
			if (!result) {
				toast.error("Address not found — please enter manually.");
				return;
			}
			setForm((prev) => ({
				...prev,
				barLat: String(result.lat),
				barLng: String(result.lng),
			}));
			toast.success(`Gefunden: ${result.displayName}`, { duration: 6000 });
		} catch {
			toast.error("Geocoding failed. Please try again later.");
		} finally {
			setGeocoding(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!id || !mode) return;
		if ((mode === "venue" || mode === "claim") && !venueId) return;

		const latParsed = parseCoord(form.barLat, 90);
		const lngParsed = parseCoord(form.barLng, 180);
		const hasLatInput = form.barLat.trim() !== "";
		const hasLngInput = form.barLng.trim() !== "";
		if ((hasLatInput || hasLngInput) && (latParsed === null || lngParsed === null)) {
			toast.error("Lat/Lng must be valid numbers (Lat -90..90, Lng -180..180).");
			return;
		}
		if (mode === "venue" && (latParsed === null || lngParsed === null)) {
			toast.error("An existing bar needs valid coordinates.");
			return;
		}
		if (mode === "venue" && latParsed === 0 && lngParsed === 0) {
			toast.error("Coordinates cannot be 0,0.");
			return;
		}

		setSubmitting(true);
		try {
			const neighborhoodToSave = derivedNeighborhood || existingNeighborhood;
			if (mode === "venue" && venueId) {
				await updateOrganizerAccount(
					id,
					{ firstName: form.firstName, lastName: form.lastName },
					{
						id: venueId,
						name: form.barName,
						address: form.barAddress,
						neighborhood: neighborhoodToSave,
						website: form.barWebsite || null,
						instagram: form.barInstagram || null,
						phone: form.barPhone || null,
						lat: latParsed as number,
						lng: lngParsed as number,
					},
				);
			} else if (mode === "claim" && venueId) {
				// Claim mode keeps the existing venue's coords — don't pass lat/lng.
				await updateOrganizerAccount(
					id,
					{ firstName: form.firstName, lastName: form.lastName },
					{
						id: venueId,
						name: form.barName,
						address: form.barAddress,
						neighborhood: neighborhoodToSave,
						website: form.barWebsite || null,
						instagram: form.barInstagram || null,
						phone: form.barPhone || null,
					},
				);
				await clearVenueClaimProposals(id);
			} else {
				await updateProfile(id, { firstName: form.firstName, lastName: form.lastName });
				await updatePendingBarSubmission(id, {
					name: form.barName,
					address: form.barAddress,
					neighborhood: neighborhoodToSave,
					website: form.barWebsite || null,
					instagram: form.barInstagram || null,
					phone: form.barPhone || null,
					lat: latParsed,
					lng: lngParsed,
				});
			}
			toast.success(
				mode === "pending"
					? "Pending submission updated!"
					: mode === "claim"
						? "Claimed bar updated!"
						: "Bar account updated!",
			);
			navigate(returnPath);
		} catch {
			toast.error("Something went wrong. Please try again.");
		} finally {
			setSubmitting(false);
		}
	};

	if (authLoading || !roleResolved) {
		return <PageSpinner />;
	}
	if (role !== "admin") return null;

	if (notFound) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<p className="text-muted-foreground">Bar account not found.</p>
			</div>
		);
	}

	if (!mode) {
		return <PageSpinner />;
	}

	return (
		<div className="container max-w-2xl py-8">
					<h1 className="heading-display text-3xl mb-2">
						{mode === "pending"
							? "Edit Pending Submission"
							: mode === "claim"
								? "Edit Claimed Bar"
								: "Edit Bar Account"}
					</h1>
					<p className="text-muted-foreground text-sm mb-8">
						{email ? `Editing account for ${email}. ` : ""}
						{mode === "pending"
							? "Changes apply to the pending submission. Approve from the admin dashboard to publish."
							: mode === "claim"
								? "Changes are saved directly to the venue. The pending claim's proposed values will be cleared."
								: "Changes are saved directly."}
					</p>

					<form onSubmit={handleSubmit} className="space-y-6">
						<div className="flex gap-2">
							<div className="flex-1 space-y-1.5">
								<label className="text-sm font-medium">First name <span className="text-accent">*</span></label>
								<input
									type="text"
									required
									value={form.firstName}
									onChange={(e) => update("firstName", e.target.value)}
									className="w-full h-10 px-3 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:border-foreground transition-colors"
								/>
							</div>
							<div className="flex-1 space-y-1.5">
								<label className="text-sm font-medium">Last name <span className="text-accent">*</span></label>
								<input
									type="text"
									required
									value={form.lastName}
									onChange={(e) => update("lastName", e.target.value)}
									className="w-full h-10 px-3 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:border-foreground transition-colors"
								/>
							</div>
						</div>

						<div className="space-y-3 border-l-2 border-foreground pl-4">
							<div className="space-y-1.5">
								<label className="text-sm font-medium">Bar name <span className="text-accent">*</span></label>
								<input
									type="text"
									required
									value={form.barName}
									onChange={(e) => update("barName", e.target.value)}
									className="w-full h-10 px-3 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:border-foreground transition-colors"
								/>
							</div>
							<div className="space-y-1.5">
								<label className="text-sm font-medium">Address <span className="text-accent">*</span></label>
								<input
									type="text"
									required
									value={form.barAddress}
									onChange={(e) => update("barAddress", e.target.value)}
									className="w-full h-10 px-3 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:border-foreground transition-colors"
								/>
								<p className="text-xs text-muted-foreground">
									Neighborhood: {derivedNeighborhood || existingNeighborhood || "—"}
									{derivedNeighborhood && existingNeighborhood && derivedNeighborhood !== existingNeighborhood && " (will update on save)"}
								</p>
							</div>
							<div className="space-y-1.5">
								<label className="text-sm font-medium">Website</label>
								<input
									type="url"
									value={form.barWebsite}
									onChange={(e) => update("barWebsite", e.target.value)}
									placeholder="https://yourbar.de"
									className="w-full h-10 px-3 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:border-foreground transition-colors"
								/>
							</div>
							<div className="space-y-1.5">
								<label className="text-sm font-medium">Instagram</label>
								<input
									type="text"
									value={form.barInstagram}
									onChange={(e) => update("barInstagram", e.target.value)}
									placeholder="@yourbar"
									className="w-full h-10 px-3 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:border-foreground transition-colors"
								/>
							</div>
							<div className="space-y-1.5">
								<label className="text-sm font-medium">Phone</label>
								<input
									type="tel"
									value={form.barPhone}
									onChange={(e) => update("barPhone", e.target.value)}
									placeholder="+49 30 123456"
									className="w-full h-10 px-3 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:border-foreground transition-colors"
								/>
							</div>

							{mode !== "claim" && (
								<div className="space-y-2 pt-2 border-t border-border">
									<div className="flex items-center justify-between gap-3">
										<div>
											<p className="text-sm font-medium">Coordinates {mode === "venue" && <span className="text-accent">*</span>}</p>
											<p className="text-xs text-muted-foreground">
												{mode === "pending"
													? "Optional — auto-fetched from the address on approve if left empty."
													: "Required — shown on the map."}
											</p>
										</div>
										<button
											type="button"
											onClick={handleGeocode}
											disabled={geocoding || !form.barAddress.trim()}
											className="h-9 px-3 border border-border text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50 whitespace-nowrap"
										>
											{geocoding ? "Searching…" : "Get from address"}
										</button>
									</div>
									<div className="flex gap-2">
										<div className="flex-1 space-y-1.5">
											<label className="text-xs text-muted-foreground">Latitude</label>
											<input
												type="number"
												step="any"
												value={form.barLat}
												onChange={(e) => update("barLat", e.target.value)}
												placeholder="52.5200"
												className="w-full h-10 px-3 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:border-foreground transition-colors"
											/>
										</div>
										<div className="flex-1 space-y-1.5">
											<label className="text-xs text-muted-foreground">Longitude</label>
											<input
												type="number"
												step="any"
												value={form.barLng}
												onChange={(e) => update("barLng", e.target.value)}
												placeholder="13.4050"
												className="w-full h-10 px-3 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:border-foreground transition-colors"
											/>
										</div>
									</div>
								</div>
							)}
						</div>

						<div className="flex gap-3 pt-4">
							<button
								type="submit"
								disabled={submitting}
								className="flex-1 h-12 bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-50"
							>
								{submitting ? "Saving…" : "Save Changes"}
							</button>
							<Link
								to={returnPath}
								className="h-12 px-6 flex items-center border border-border text-sm font-medium hover:bg-muted transition-colors"
							>
								Cancel
							</Link>
						</div>
					</form>
		</div>
	);
}
