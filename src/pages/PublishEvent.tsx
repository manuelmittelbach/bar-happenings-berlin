import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, Clock3, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { createEvent, createUserStagedSubmission, fetchOrganizerById, uploadEventImage } from "@/lib/supabaseQueries";
import EventForm, { type EventFormData, type EventFormImageState, type VenueOption } from "@/components/events/EventForm";
import { useVenues } from "@/hooks/useEvents";
import { generateOccurrences, type RecurrenceFreq } from "@/lib/recurrence";
import { PageSpinner } from "@/components/ui/page-spinner";

export default function PublishEvent() {
	const navigate = useNavigate();
	const location = useLocation();
	const queryClient = useQueryClient();
	const { user, role, approvalStatus, loading, roleResolved } = useAuth();
	const [venuePrefill, setVenuePrefill] = useState<Partial<EventFormData>>({});
	const [venueId, setVenueId] = useState<string | null>(null);

	// Plain users have no bar of their own: they publish into moderation
	// (pending) and pick the location from the directory or type it in.
	const isPlainUser = role === "user";
	const { data: allVenues = [] } = useVenues();
	const venueOptions: VenueOption[] = useMemo(
		() =>
			allVenues
				.map((v) => ({
					id: v.id,
					name: v.name,
					address: v.address ?? "",
					neighborhood: v.neighborhood ?? "",
				}))
				.sort((a, b) => a.name.localeCompare(b.name)),
		[allVenues],
	);

	useEffect(() => {
		if (loading) return;
		if (!user) {
			navigate("/signin", { replace: true });
			return;
		}
		if (!roleResolved) return;
		// Any signed-in role may publish now (user / organizer / admin).
		if (role !== "user" && role !== "organizer" && role !== "admin") {
			navigate("/", { replace: true });
		}
	}, [loading, user, role, roleResolved, navigate]);

	useEffect(() => {
		// Only bar owners / admins prefill from their own venue; plain users
		// choose a location in the form instead.
		if (!user || isPlainUser) return;
		fetchOrganizerById(user.id).then((organizer) => {
			const v = organizer?.venue;
			if (!v) return;
			setVenuePrefill({
				venue: v.name ?? "",
				address: v.address ?? "",
				neighborhood: v.neighborhood ?? "",
			});
			setVenueId(v.id ?? null);
		});
	}, [user, isPlainUser]);

	const handleSubmit = useMemo(
		() => async (data: EventFormData, image: EventFormImageState) => {
			if (!user) return;
			try {
				const imageUrl = image.file ? await uploadEventImage(image.file, user.id) : undefined;
				// Plain users land in moderation; bar owners / admins publish live.
				const status = isPlainUser ? "pending" : "approved";
				if (isPlainUser) {
					// Plain users submit into venue_events_staging (one template row,
					// even for a series) — same moderation pipeline as everything else.
					await createUserStagedSubmission({ ...data, venueId: data.venueId || undefined }, user.id, imageUrl);
				} else {
					// Bar owners / admins publish straight to `events`. Picker (if shown)
					// wins; otherwise the bar owner's own venue.
					const resolvedVenueId = data.venueId || venueId || undefined;
					await createEvent({ ...data, venueId: resolvedVenueId, status: "approved" }, user.id, imageUrl);
				}
				queryClient.invalidateQueries({ queryKey: ["events"] });
				const isSeries = !!(data.recurrence && data.recurrenceUntil);
				const count = isSeries
					? generateOccurrences(data.date, data.recurrence as RecurrenceFreq, data.recurrenceUntil).length
					: 1;
				if (status === "pending") {
					toast.success(isSeries ? "Series submitted!" : "Event submitted!", {
						description: "An admin will review it before it goes live.",
					});
				} else if (isSeries) {
					toast.success("Series published!", { description: `${count} events are now live on Inside Bars.` });
				} else {
					toast.success("Event published!", { description: "Your event is now live on Inside Bars." });
				}
				// Pop /publish off the history instead of pushing /profile/events
				// on top of it. /profile/events is already the previous entry in
				// the normal flow, so back from it after publish lands wherever
				// the user came from. `location.key === "default"` means deep-link
				// (nothing to pop) — fall back to a replace-nav onto /profile/events.
				if (location.key !== "default") {
					navigate(-1);
				} else {
					navigate("/profile/events", { replace: true });
				}
			} catch {
				toast.error("Something went wrong. Please try again.");
			}
		},
		[user, navigate, queryClient, venueId, isPlainUser, location.key]
	);

	if (loading || !roleResolved) {
		return <PageSpinner />;
	}
	if (!user || (role !== "user" && role !== "organizer" && role !== "admin")) return null;

	if (role === "organizer" && approvalStatus !== "approved") {
		const rejected = approvalStatus === "rejected";
		return (
			<div className="flex-1 flex items-center justify-center py-16">
				<div className="w-full max-w-md mx-auto px-4 text-center space-y-5">
					<div className="flex justify-center">
						{rejected ? (
							<XCircle className="h-10 w-10 text-accent" />
						) : (
							<Clock3 className="h-10 w-10 text-muted-foreground" />
						)}
					</div>
					<h1 className="heading-display text-2xl">
						{rejected ? "Application not approved" : "Awaiting admin approval"}
					</h1>
					<p className="text-sm text-muted-foreground leading-relaxed">
						{rejected
							? "Your bar account application was not approved, so you can't publish events. If you think this is a mistake, please contact us."
							: "An admin needs to review your bar details before you can publish events. You'll be able to publish as soon as your account is approved."}
					</p>
				</div>
			</div>
		);
	}

	return (
		<>
			{/* Sticky Back row — same affordance as the dashboard / detail pages. */}
			<div className="sticky z-40 bg-background" style={{ top: "var(--header-h)" }}>
				<div className="container flex items-center py-2">
					<button
						type="button"
						onClick={() => navigate(-1)}
						className="inline-flex items-center gap-1 p-2 -ml-2 text-foreground active:opacity-60 hover:opacity-70 transition-opacity"
						aria-label="Back"
					>
						<ChevronLeft className="h-5 w-5" />
						<span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]">Back</span>
					</button>
				</div>
			</div>
			<EventForm
				title="Publish an Event"
				subtitle={
					isPlainUser
						? "An admin reviews your event before it goes live."
						: "Once published, it appears directly on the front page."
				}
				initialValues={venuePrefill}
				venueOptions={isPlainUser ? venueOptions : undefined}
				submitLabel={isPlainUser ? "Submit for review" : "Publish Event"}
				onSubmit={handleSubmit}
				optionalEntryInfo={role === "admin"}
				secondaryActions={
					// Go back rather than pushing a new /profile/events entry — otherwise
					// the stack becomes events → publish → events, and pressing
					// Back on "Your events" would return to the publish form.
					<button
						type="button"
						onClick={() => navigate(-1)}
						className="h-12 px-6 flex items-center border-2 border-foreground font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-foreground hover:bg-foreground hover:text-background transition-colors"
					>
						Cancel
					</button>
				}
			/>
		</>
	);
}
