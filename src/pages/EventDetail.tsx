import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import {
	MapPin, ExternalLink,
	ChevronDown, Plus
} from "lucide-react";
import ShareMenu from "@/components/events/ShareMenu";
import { motion } from "framer-motion";
import { formatDateWithDay, formatDateShort } from "@/lib/dateFormat";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { useEventById, useEventsByParentId } from "@/hooks/useEvents";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { saveInterest, deleteInterest, checkInterest } from "@/lib/supabaseQueries";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function formatLanguage(raw: string | undefined): string | null {
	if (!raw) return null;
	return `in ${raw}`;
}

export default function EventDetail() {
	const { id } = useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const { data: event, isLoading } = useEventById(id || "");
	const { data: siblings = [] } = useEventsByParentId(event?.parentId || "");
	const [saved, setSaved] = useState(false);
	const [datesOpen, setDatesOpen] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	const baseCount = useMemo(() => {
		if (!id) return 0;
		const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
		return (hash % 42) + 1;
	}, [id]);

	const [interestedCount, setInterestedCount] = useState(baseCount);

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

	const handleSave = async () => {
		if (!event) return;

		if (saved) {
			// Un-save
			setSaved(false);
			setInterestedCount(prev => prev - 1);
			if (user) {
				deleteInterest(user.id, event.id).then(() => {
					queryClient.invalidateQueries({ queryKey: ["event", event.id] });
					queryClient.invalidateQueries({ queryKey: ["my-events", user.id] });
				});
			}
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
				<p className="font-body text-sm text-muted-foreground">Loading…</p>
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

	const today = new Date();
	today.setHours(6, 0, 0, 0);
	const todayStr = today.toISOString().split("T")[0];
	const siblingDates = siblings.map(e => e.date).filter((d, i, arr) => arr.indexOf(d) === i && d >= todayStr).sort();
	const displayTitle = cleanEventTitle(event.title, event.venue);
	const hasRealImage = !!event.image;

	const priceLabel = event.price
		? event.price.split(" — ")[0]
		: "Free entry";

	const handleMaps = () => {
		window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address || event.venue)}`, '_blank');
	};

	return (
		<div className="bg-background pb-24">
			{/* === ABOVE THE FOLD: Decision Zone === */}
			<div className="max-w-screen-md mx-auto">

				{/* Hero image — compact */}
				<div className="relative h-[180px] md:h-[260px] bg-muted overflow-hidden">
					{hasRealImage && (
						<img
							src={event.image!}
							alt={displayTitle}
							style={{ objectPosition: event.imagePosition }}
							className="absolute inset-0 w-full h-full object-cover"
						/>
					)}
					<div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
					<div className="absolute top-3 left-4">
						<ShareMenu eventTitle={displayTitle} eventId={event.id} variant="header" />
					</div>
				</div>

				{event.status === "canceled" && (
					<div className="px-4 pt-4">
						<p className="font-body text-sm font-extrabold uppercase tracking-wider text-red-600">
							Got canceled by the organizer
						</p>
					</div>
				)}

				{/* Core info block */}
				<div className="px-4 pt-4 pb-1">
					<motion.h1
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.3 }}
						className="font-body text-[22px] md:text-3xl font-extrabold leading-[1.1] tracking-tight"
					>
						{displayTitle}
					</motion.h1>
				</div>

				{/* Interested row */}
				<div className="px-4 pb-4 pt-3">
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-baseline gap-2">
							<span className="font-body text-3xl font-extrabold text-accent">{interestedCount}</span>
							<span className="font-body text-sm font-bold text-accent uppercase tracking-wider">Interested</span>
						</div>
						<button
							onClick={handleSave}
							disabled={isSaving}
							className={`h-12 px-6 flex items-center gap-2 text-sm font-bold uppercase tracking-wider font-body rounded-full border-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-70 ${saved
									? "bg-accent text-accent-foreground border-accent"
									: "bg-transparent text-foreground border-accent hover:bg-accent/10"
								}`}
						>
							{!saved && <Plus className="h-4 w-4" />}
							Interested
						</button>
					</div>
				</div>

				<div className="border-t border-border mx-4" />

				{/* Key details */}
				<div className="px-4 pt-3 pb-3 grid grid-cols-2 gap-4">
					{/* When */}
					<div>
						<p className="font-body font-bold text-sm">{formatDateWithDay(event.date)}</p>
						{event.startTime && (
							<p className="text-foreground font-mono text-sm mt-0.5">
								{event.startTime}{event.endTime ? ` – ${event.endTime}` : ''}
							</p>
						)}
					</div>

					{/* Where */}
					<div className="text-left">
						<p className="font-body font-bold text-sm">{event.venue}</p>
						{event.address && (
							<p className="text-muted-foreground text-[11px] mt-0.5">{event.address}</p>
						)}
						<p className="text-muted-foreground text-[11px] mt-0.5 flex items-center gap-1">
							<MapPin className="h-3 w-3 shrink-0" /> {event.neighborhood}
						</p>
						<button
							onClick={handleMaps}
							className="text-xs font-mono text-accent mt-1 block cursor-pointer"
						>
							Open in Maps
						</button>
					</div>
				</div>

				<div className="border-t border-border mx-4" />

				{/* === BELOW THE FOLD: Details === */}

				{/* About this event */}
				<div className="px-4 py-5 space-y-4">
					<h2 className="font-body text-sm font-bold uppercase tracking-[0.12em]">About this event</h2>
					<p className="text-sm text-muted-foreground">
						{[priceLabel, event.recurrence || null, formatLanguage(event.language)].filter(Boolean).join(" · ")}
					</p>
					<div />
					{event.description.split("\n\n").map((p, i) => (
						<p key={i} className="text-sm text-muted-foreground/80 leading-[1.75] font-body">{p}</p>
					))}
				</div>

				<div className="border-t border-border mx-4" />

				{/* Utility rows */}
				<div className="px-4">
					{/* Upcoming dates */}
					{siblingDates.length > 1 && (
						<div className="border-b border-border">
							<button
								className="w-full flex items-center justify-between py-3.5 text-sm text-foreground hover:text-accent transition-colors"
								onClick={() => setDatesOpen(!datesOpen)}
							>
								<span className="font-medium">Upcoming events in this bar</span>
								<ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${datesOpen ? 'rotate-180' : ''}`} />
							</button>
							{datesOpen && (
								<div className="flex flex-wrap gap-2 pb-3.5">
									{siblingDates.map(d => {
										const siblingEvent = siblings.find(e => e.date === d);
										const isActive = d === event.date;
										return (
											<button
												key={d}
												onClick={() => {
													if (!isActive && siblingEvent) {
														navigate(`/event/${siblingEvent.id}`);
													}
												}}
												className={`inline-flex items-center px-3 py-1.5 text-[11px] font-mono font-bold transition-all active:scale-95 ${isActive
														? 'bg-accent text-accent-foreground'
														: 'border-2 border-border text-muted-foreground hover:border-foreground hover:text-foreground cursor-pointer'
													}`}
											>
												{formatDateShort(d)}
											</button>
										);
									})}
								</div>
							)}
						</div>
					)}

					{event.url && (
						<a
							href={event.url}
							target="_blank"
							rel="noopener noreferrer"
							className="group w-full flex items-center justify-between py-3.5 border-b border-border text-sm text-foreground hover:text-accent transition-colors"
						>
							<span className="font-medium">Event link</span>
							<ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
						</a>
					)}
				</div>

				<div className="h-6" />
			</div>

		</div>
	);
}
