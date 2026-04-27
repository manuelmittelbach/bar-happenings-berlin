import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMyEvents } from "@/hooks/useEvents";
import EventCard from "@/components/events/EventCard";
import { Spinner } from "@/components/ui/spinner";
import type { BarlinEvent } from "@/types/event";
import { EXPLORE_SCROLL_KEY } from "@/pages/Index";
import { consumeJustConfirmed, clearJustConfirmedSoon } from "@/lib/justConfirmed";

function formatDateHeader(dateStr: string) {
	const today = new Date().toISOString().split("T")[0];
	const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
	const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

	if (dateStr === today) return "Today";
	if (dateStr === tomorrow) return "Tomorrow";
	if (dateStr === yesterday) return "Yesterday";

	const d = new Date(dateStr + "T00:00:00");
	return d.toLocaleDateString("en-GB", {
		weekday: "long",
		day: "numeric",
		month: "short",
	});
}

function formatPastDateHeader(dateStr: string) {
	const d = new Date(dateStr + "T00:00:00");
	return d.toLocaleDateString("en-GB", {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
}

function groupByDate(events: BarlinEvent[]) {
	const groups: { date: string; events: BarlinEvent[] }[] = [];

	events.forEach((e) => {
		const last = groups[groups.length - 1];
		if (last && last.date === e.date) {
			last.events.push(e);
		} else {
			groups.push({ date: e.date, events: [e] });
		}
	});

	return groups;
}

export default function MyEvents() {
	const navigate = useNavigate();
	const { user, loading } = useAuth();
	const { data: events = [], isLoading: eventsLoading } = useMyEvents(user?.id ?? null);
	const [showPast, setShowPast] = useState(false);

	const [justConfirmed] = useState(consumeJustConfirmed);

	useEffect(() => {
		if (!justConfirmed) return;
		return clearJustConfirmedSoon();
	}, [justConfirmed]);

	const isLateNight = new Date().getHours() < 6;
	const today = new Date().toISOString().split("T")[0];
	const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
	const cutoff = isLateNight ? yesterday : today;

	const sorted = [...events].sort(
		(a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
	);

	const yesterdayEvents = isLateNight ? sorted.filter((e) => e.date === yesterday) : [];
	const upcomingEvents = sorted.filter((e) => e.date >= today);
	const pastEvents = [...events]
		.filter((e) => e.date < cutoff)
		.sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime))
		.slice(0, 10);

	if (loading) {
		return (
			<div className="flex-1 flex items-center justify-center bg-background">
				<Spinner />
			</div>
		);
	}

	if (!user) {
		return <Navigate to="/login" state={{ from: "/my-events" }} replace />;
	}

	const hasAnyEvents = yesterdayEvents.length > 0 || upcomingEvents.length > 0;

	return (
		<div className="bg-background pb-24">
			<div className="max-w-screen-sm mx-auto px-4 pt-6">
				{justConfirmed && (
					<div className="mt-6 inline-flex items-center gap-2 px-3 py-2 rounded-sm bg-green-500/10 text-green-600 text-sm font-medium">
						<CheckCircle2 className="h-4 w-4" /> Email confirmed!
					</div>
				)}
				<div className="mt-12 mb-8 flex justify-center">
					<button
						onClick={() => {
							sessionStorage.setItem("inside-bars-scroll-to-filter", "1");
							sessionStorage.removeItem(EXPLORE_SCROLL_KEY);
							navigate("/");
						}}
						className="inline-flex h-11 px-6 items-center bg-background border-2 border-accent text-accent font-heading font-bold uppercase tracking-widest text-xs hover:bg-accent hover:text-white transition-colors"
					>
						Discover events
					</button>
				</div>

				{eventsLoading ? (
					<p className="text-sm text-muted-foreground">Loading your events…</p>
				) : !hasAnyEvents && pastEvents.length === 0 ? (
					<div className="flex flex-col items-center py-16 gap-4 text-center">
						<p className="font-body font-bold">Nothing saved yet</p>
						<p className="text-sm text-muted-foreground">
							Tap "Interested" on any event to save it here.
						</p>
					</div>
				) : (
					<div className="space-y-8">
						{yesterdayEvents.length > 0 && (
							<div>
								<h2 className="font-heading text-xl font-extrabold uppercase tracking-tight mb-4 pb-2 border-b-2 border-foreground">
									Yesterday
								</h2>
								<div className="grid grid-cols-1 gap-6">
									{yesterdayEvents.map((event, i) => (
										<EventCard key={event.id} event={event} index={i} featured={false} />
									))}
								</div>
							</div>
						)}

						{groupByDate(upcomingEvents).map((group) => (
							<div key={group.date}>
								<h2 className="font-heading text-xl font-extrabold uppercase tracking-tight mb-4 pb-2 border-b-2 border-foreground">
									{formatDateHeader(group.date)}
								</h2>
								<div className="grid grid-cols-1 gap-6">
									{group.events.map((event, i) => (
										<EventCard key={event.id} event={event} index={i} featured={false} />
									))}
								</div>
							</div>
						))}

						{pastEvents.length > 0 && (
							<div>
								<button
									onClick={() => setShowPast(!showPast)}
									className="flex items-center gap-2 font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
								>
									{showPast ? (
										<ChevronUp className="h-4 w-4" />
									) : (
										<ChevronDown className="h-4 w-4" />
									)}
									Past events
								</button>

								{showPast && (
									<div className="mt-4 space-y-8">
										{groupByDate(pastEvents).map((group) => (
											<div key={group.date}>
												<h2 className="font-heading text-base font-extrabold uppercase tracking-tight mb-4 pb-2 border-b border-border text-muted-foreground">
													{formatPastDateHeader(group.date)}
												</h2>
												<div className="grid grid-cols-1 gap-6 opacity-60 pointer-events-none cursor-default">
													{group.events.map((event, i) => (
														<EventCard key={event.id} event={event} index={i} featured={false} />
													))}
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}