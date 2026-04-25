import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { fetchOrganizerById, updateOrganizerAccount } from "@/lib/supabaseQueries";
import { deriveNeighborhoodFromAddress } from "@/lib/neighborhoodFromAddress";
import { Spinner } from "@/components/ui/spinner";

export default function EditBarAccount() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const location = useLocation();
	const returnPath =
		(location.state as { returnPath?: string } | null)?.returnPath ?? "/admin";
	const { role, loading: authLoading, roleResolved } = useAuth();
	const [submitting, setSubmitting] = useState(false);
	const [notFound, setNotFound] = useState(false);
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
				if (!organizer || !organizer.venue) {
					setNotFound(true);
					return;
				}
				setVenueId(organizer.venue.id);
				setEmail(organizer.email);
				setExistingNeighborhood(organizer.venue.neighborhood);
				setForm({
					firstName: organizer.firstName,
					lastName: organizer.lastName,
					barName: organizer.venue.name,
					barAddress: organizer.venue.address,
					barWebsite: organizer.venue.website ?? "",
					barInstagram: organizer.venue.instagram ?? "",
					barPhone: organizer.venue.phone ?? "",
				});
			})
			.catch(() => setNotFound(true));
	}, [id, role, authLoading, roleResolved, navigate]);

	const update = (field: keyof typeof form, value: string) =>
		setForm((prev) => ({ ...prev, [field]: value }));

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!id || !venueId) return;
		setSubmitting(true);
		try {
			const derived = deriveNeighborhoodFromAddress(form.barAddress);
			const neighborhoodToSave = derived || existingNeighborhood;
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
			toast.success("Bar account updated!");
			navigate(returnPath);
		} catch {
			toast.error("Something went wrong. Please try again.");
		} finally {
			setSubmitting(false);
		}
	};

	if (authLoading || !roleResolved) {
		return (
			<div className="flex-1 flex items-center justify-center py-16">
				<Spinner />
			</div>
		);
	}
	if (role !== "admin") return null;

	if (notFound) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<p className="text-muted-foreground">Bar account not found.</p>
			</div>
		);
	}

	return (
		<div className="container max-w-2xl py-8">
					<h1 className="heading-display text-3xl mb-2">Edit Bar Account</h1>
					<p className="text-muted-foreground text-sm mb-8">
						{email ? `Editing account for ${email}. ` : ""}Changes are saved directly.
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
									className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
								/>
							</div>
							<div className="flex-1 space-y-1.5">
								<label className="text-sm font-medium">Last name <span className="text-accent">*</span></label>
								<input
									type="text"
									required
									value={form.lastName}
									onChange={(e) => update("lastName", e.target.value)}
									className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
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
									className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
								/>
							</div>
							<div className="space-y-1.5">
								<label className="text-sm font-medium">Address <span className="text-accent">*</span></label>
								<input
									type="text"
									required
									value={form.barAddress}
									onChange={(e) => update("barAddress", e.target.value)}
									className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
								/>
							</div>
							<div className="space-y-1.5">
								<label className="text-sm font-medium">Website</label>
								<input
									type="url"
									value={form.barWebsite}
									onChange={(e) => update("barWebsite", e.target.value)}
									placeholder="https://yourbar.de"
									className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
								/>
							</div>
							<div className="space-y-1.5">
								<label className="text-sm font-medium">Instagram</label>
								<input
									type="text"
									value={form.barInstagram}
									onChange={(e) => update("barInstagram", e.target.value)}
									placeholder="@yourbar"
									className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
								/>
							</div>
							<div className="space-y-1.5">
								<label className="text-sm font-medium">Phone</label>
								<input
									type="tel"
									value={form.barPhone}
									onChange={(e) => update("barPhone", e.target.value)}
									placeholder="+49 30 123456"
									className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
								/>
							</div>
						</div>

						<div className="flex gap-3 pt-4">
							<button
								type="submit"
								disabled={submitting}
								className="flex-1 h-12 bg-foreground text-background rounded-sm text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-50"
							>
								{submitting ? "Saving…" : "Save Changes"}
							</button>
							<Link
								to={returnPath}
								className="h-12 px-6 flex items-center border border-border rounded-sm text-sm font-medium hover:bg-muted transition-colors"
							>
								Cancel
							</Link>
						</div>
					</form>
		</div>
	);
}
