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
			{/* Warm atmosphere — selbes Disk-Pattern wie auf Index, damit
			    Detail- und Liste-Seite dieselbe Color-Sprache sprechen.
			    Zwei Paare (Orange + Amber Disks mit Hero-Spec) reichen
			    für die typische Artikellänge. */}
			<div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
				{/* Pair 1 — orange right, amber left, sits at the lede figure */}
				<div
					className="absolute right-[-22%] top-[100px] h-[600px] w-[600px] rounded-full"
					style={{
						background:
							"radial-gradient(circle at center, hsla(18, 85%, 52%, 0.07), hsla(18, 85%, 52%, 0) 60%)",
						filter: "blur(40px)",
					}}
				/>
				<div
					className="absolute left-[-15%] top-[180px] h-[420px] w-[420px] rounded-full"
					style={{
						background:
							"radial-gradient(circle at center, hsla(28, 85%, 55%, 0.05), hsla(28, 85%, 55%, 0) 60%)",
						filter: "blur(40px)",
					}}
				/>
				{/* Pair 2 — flips sides, sits around the venue card / footer */}
				<div
					className="absolute left-[-22%] top-[1000px] h-[600px] w-[600px] rounded-full"
					style={{
						background:
							"radial-gradient(circle at center, hsla(18, 85%, 52%, 0.07), hsla(18, 85%, 52%, 0) 60%)",
						filter: "blur(40px)",
					}}
				/>
				<div
					className="absolute right-[-15%] top-[1100px] h-[420px] w-[420px] rounded-full"
					style={{
						background:
							"radial-gradient(circle at center, hsla(28, 85%, 55%, 0.05), hsla(28, 85%, 55%, 0) 60%)",
						filter: "blur(40px)",
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
