import { useParams, useNavigate, Link } from "react-router-dom";
import { useEventById, useEventSeries } from "@/hooks/useEvents";
import { useAuth } from "@/hooks/useAuth";
import { formatRecurrenceLabel } from "@/lib/recurrence";
import EventDetailView from "@/components/events/EventDetailView";
import { PageSpinner } from "@/components/ui/page-spinner";

export default function EventDetail() {
	const { id } = useParams();
	const navigate = useNavigate();
	const { role, roleResolved } = useAuth();
	const { data: event, isLoading, error, refetch, isFetching } = useEventById(id || "");
	const seriesId = event ? (event.parentId || event.id) : "";
	const { data: seriesMembers = [] } = useEventSeries(seriesId);

	if (isLoading) {
		return <PageSpinner />;
	}

	if (error) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center bg-background px-6 text-center">
				<h1 className="font-body text-2xl font-bold">Couldn't load event</h1>
				<p className="text-sm text-muted-foreground mt-2 max-w-xs">
					Check your connection and try again.
				</p>
				<button
					onClick={() => refetch()}
					disabled={isFetching}
					className="mt-4 px-5 py-2.5 rounded-full border-2 border-foreground bg-background text-foreground font-mono font-bold text-sm uppercase tracking-wider hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
				>
					{isFetching ? "Retrying…" : "Retry"}
				</button>
				<Link to="/" className="text-sm text-accent mt-4 inline-block">Back to home</Link>
			</div>
		);
	}

	if (!event) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center bg-background">
				<h1 className="font-body text-2xl font-bold">Event not found</h1>
				<Link to="/" className="text-sm text-accent mt-2 inline-block">Back to home</Link>
			</div>
		);
	}

	const seriesRule = seriesMembers.find((m) => m.recurrence)?.recurrence ?? "";
	const seriesLastDate = seriesMembers.reduce((max, m) => (m.date > max ? m.date : max), "");
	const isLastInSeries = seriesMembers.length > 1 && event.date === seriesLastDate;
	const recurrenceLabel = isLastInSeries ? null : formatRecurrenceLabel(seriesRule);

	const handleMaps = () => {
		window.open(
			`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address || event.venue)}`,
			"_blank",
		);
	};

	const canEdit = roleResolved && role === "admin";

	return (
		<div className="relative isolate bg-background pb-24">
			{/* Warm atmosphere — same hue family as Index but at a fraction
			    of the intensity. The detail page is a reading surface, so
			    the wash only suggests warmth without coloring the paper. */}
			<div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
				<div
					className="absolute right-[-25%] top-[-300px] h-[640px] w-[1500px] rounded-full"
					style={{
						background:
							"radial-gradient(ellipse at center, hsla(18, 85%, 52%, 0.07), hsla(18, 85%, 52%, 0) 60%)",
						filter: "blur(60px)",
					}}
				/>
				<div
					className="absolute -left-[25%] top-[1200px] h-[680px] w-[1600px] rounded-full"
					style={{
						background:
							"radial-gradient(ellipse at center, hsla(28, 85%, 60%, 0.03), hsla(28, 85%, 60%, 0) 65%)",
						filter: "blur(70px)",
					}}
				/>
			</div>
			<EventDetailView
				event={event}
				recurrenceLabel={recurrenceLabel}
				onOpenMaps={handleMaps}
				showShare={true}
				onEdit={canEdit ? () => navigate(`/edit-event/${event.id}`) : undefined}
			/>
		</div>
	);
}
