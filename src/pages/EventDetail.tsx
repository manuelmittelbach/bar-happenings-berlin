import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useEventById, useEventSeries } from "@/hooks/useEvents";
import { useAuth } from "@/hooks/useAuth";
import { saveInterest, deleteInterest, checkInterest } from "@/lib/supabaseQueries";
import { formatRecurrenceLabel } from "@/lib/recurrence";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { SHOW_INTEREST_COUNT } from "@/lib/featureFlags";
import { berlinDateString } from "@/lib/dateFormat";
import EventDetailView from "@/components/events/EventDetailView";

export default function EventDetail() {
	const { id } = useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const { data: event, isLoading } = useEventById(id || "");
	const seriesId = event ? (event.parentId || event.id) : "";
	const { data: seriesMembers = [] } = useEventSeries(seriesId);
	const [saved, setSaved] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [interestedCount, setInterestedCount] = useState(0);
	const [upcomingOpen, setUpcomingOpen] = useState(false);

	// Sync interestedCount with real DB value once event loads
	useEffect(() => {
		if (event?.interestedCount != null) {
			setInterestedCount(event.interestedCount);
		}
	}, [event?.interestedCount]);

	// Restore saved state on mount / when user changes
	useEffect(() => {
		if (!user || !id) return;
		checkInterest(user.id, id).then(setSaved);
	}, [user, id]);

	const persistInterest = async (userId: string, eventId: string) => {
		setSaved(true);
		setInterestedCount(prev => prev + 1);
		setIsSaving(true);
		try {
			await saveInterest(userId, eventId);
			queryClient.invalidateQueries({ queryKey: ["event", eventId] });
			queryClient.invalidateQueries({ queryKey: ["my-events", userId] });
		} catch {
			setSaved(false);
			setInterestedCount(prev => prev - 1);
			toast.error("Couldn't save — please try again");
		} finally {
			setIsSaving(false);
		}
	};

	const removeInterest = async (userId: string, eventId: string) => {
		setSaved(false);
		setInterestedCount(prev => prev - 1);
		setIsSaving(true);
		try {
			await deleteInterest(userId, eventId);
			queryClient.invalidateQueries({ queryKey: ["event", eventId] });
			queryClient.invalidateQueries({ queryKey: ["my-events", userId] });
		} catch {
			setSaved(true);
			setInterestedCount(prev => prev + 1);
			toast.error("Couldn't unsave — please try again");
		} finally {
			setIsSaving(false);
		}
	};

	const handleSave = async () => {
		if (!event) return;
		if (saved) {
			if (user) await removeInterest(user.id, event.id);
			return;
		}
		if (!user) {
			navigate("/login", { state: { from: `/event/${event.id}` } });
			return;
		}
		await persistInterest(user.id, event.id);
	};

	if (isLoading) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center bg-background">
				<Spinner />
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

	const todayStr = berlinDateString();
	const siblingDates = seriesMembers
		.filter(e => e.status !== "canceled")
		.map(e => e.date)
		.filter((d, i, arr) => arr.indexOf(d) === i && d >= todayStr)
		.sort();

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

	const handleSelectSibling = (date: string) => {
		const sibling = seriesMembers.find(e => e.date === date);
		if (sibling) navigate(`/event/${sibling.id}`);
	};

	return (
		<div className="bg-background pb-24">
			<EventDetailView
				event={event}
				siblingDates={siblingDates}
				recurrenceLabel={recurrenceLabel}
				interestedCount={interestedCount}
				showInterestCount={SHOW_INTEREST_COUNT}
				saved={saved}
				isSaving={isSaving}
				onToggleInterest={handleSave}
				onSelectSibling={handleSelectSibling}
				onOpenMaps={handleMaps}
				showShare={true}
				upcomingOpen={upcomingOpen}
				onToggleUpcoming={() => setUpcomingOpen(o => !o)}
			/>
		</div>
	);
}
