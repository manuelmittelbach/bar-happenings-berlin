import { useParams, useNavigate, Link } from "react-router-dom";
import { ChevronLeft, Share } from "lucide-react";
import { toast } from "sonner";
import { Share as CapacitorShare } from "@capacitor/share";
import { useEventById, useEventSeries } from "@/hooks/useEvents";
import { useAuth } from "@/hooks/useAuth";
import { useIsNative } from "@/hooks/useIsNative";
import { formatRecurrenceLabel } from "@/lib/recurrence";
import EventDetailView from "@/components/events/EventDetailView";
import { PageSpinner } from "@/components/ui/page-spinner";

/* Production origin for shareable URLs. In Capacitor the app runs at
 * `capacitor://localhost`, which is unshareable — so we hardcode the
 * public web origin for any URL that's going to leave the device. */
const PUBLIC_ORIGIN = "https://insidebars.co";

export default function EventDetail() {
	const { id } = useParams();
	const navigate = useNavigate();
	const isNative = useIsNative();
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

	const handleShare = async () => {
		const url = `${PUBLIC_ORIGIN}/event/${event.id}`;
		const title = event.title || "Inside Bars";
		// Native iOS: use Capacitor's Share plugin → invokes UIActivityViewController
		// (the real native share sheet). navigator.share is unreliable inside
		// WKWebView, so we always go through the plugin in native context.
		if (isNative) {
			try {
				await CapacitorShare.share({ title, url, dialogTitle: "Share event" });
				return;
			} catch (err) {
				// User dismissed → silent. Anything else falls through to clipboard.
				const msg = err instanceof Error ? err.message : "";
				if (msg.toLowerCase().includes("cancel")) return;
			}
		} else if (typeof navigator.share === "function") {
			try {
				await navigator.share({ title, url });
				return;
			} catch (err) {
				if (err instanceof Error && err.name === "AbortError") return;
			}
		}
		// Fallback: clipboard. Always uses the public origin so the copied
		// link is openable from any messenger / browser.
		try {
			await navigator.clipboard.writeText(url);
			toast.success("Link copied!");
		} catch {
			toast.error("Could not share");
		}
	};

	const canEdit = roleResolved && role === "admin";

	return (
		<div className="relative isolate bg-background pb-24">
			{/* Native top bar — sticky Back / Share row, pinned right below the
			    safe-area-top spacer. Mirrors the iOS pattern Resident Advisor
			    uses on event-detail screens: small chevron-back on the left,
			    iOS-style share square on the right, no chrome between them.
			    In the browser we let the page's natural layout (back via
			    browser gesture, ShareMenu in the action row) handle these. */}
			{isNative && (
				<div
					className="sticky z-40 bg-background"
					style={{ top: "var(--header-h)" }}
				>
					<div className="flex items-center justify-between px-3 py-2">
						<button
							onClick={() => navigate(-1)}
							className="inline-flex items-center gap-1 p-2 -ml-2 text-foreground active:opacity-60 transition-opacity"
							aria-label="Back"
						>
							<ChevronLeft className="h-5 w-5" />
							<span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]">Back</span>
						</button>
						<button
							onClick={handleShare}
							className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border-2 border-foreground text-foreground active:scale-95 active:opacity-80 transition-all"
							aria-label="Share"
						>
							<Share className="h-3.5 w-3.5" />
							<span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]">
								Share
							</span>
						</button>
					</div>
				</div>
			)}
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
				/* In native, the sticky top bar already provides Share — hide
				   the inline action-row CTA to avoid two share affordances. */
				showShare={!isNative}
				onEdit={canEdit ? () => navigate(`/edit-event/${event.id}`) : undefined}
			/>
		</div>
	);
}
