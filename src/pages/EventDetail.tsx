import { useRef } from "react";
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
	// Guards against a second rapid tap re-invoking the share sheet while
	// the first is still opening. Without it, the plugin throws "Share
	// already in progress", which isn't a cancel, so the code fell through
	// to the clipboard fallback and wrongly toasted "Link copied!".
	const isSharingRef = useRef(false);
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
		// Ignore rapid double-taps while a share sheet is already opening.
		if (isSharingRef.current) return;
		isSharingRef.current = true;
		try {
			const url = `${PUBLIC_ORIGIN}/event/${event.id}`;
			const title = event.title || "Inside Bars";
			// Native iOS: use Capacitor's Share plugin → invokes UIActivityViewController
			// (the real native share sheet). navigator.share is unreliable inside
			// WKWebView, so we always go through the plugin in native context.
			if (isNative) {
				try {
					await CapacitorShare.share({ title, url, dialogTitle: "Share event" });
				} catch (err) {
					// User dismissed or a concurrent share was in progress →
					// silent. We deliberately do NOT fall through to the clipboard
					// here: the native sheet is always available, so a failure
					// means "don't copy", not "copy instead" (which produced the
					// spurious "Link copied!" on fast taps).
					const msg = err instanceof Error ? err.message : "";
					if (!msg.toLowerCase().includes("cancel")) {
						console.warn("[share] native share failed", err);
					}
				}
				return;
			}
			if (typeof navigator.share === "function") {
				try {
					await navigator.share({ title, url });
					return;
				} catch (err) {
					if (err instanceof Error && err.name === "AbortError") return;
				}
			}
			// Web fallback only: clipboard. Always uses the public origin so the
			// copied link is openable from any messenger / browser.
			try {
				await navigator.clipboard.writeText(url);
				toast.success("Link copied!");
			} catch {
				toast.error("Could not share");
			}
		} finally {
			isSharingRef.current = false;
		}
	};

	const canEdit = roleResolved && role === "admin";

	// Hide Back when this tab has no prior history (e.g. opened via
	// target="_blank" from the dashboard's View link) — a non-functional
	// Back button there is more confusing than helpful. React Router v6
	// tracks position via history.state.idx; idx === 0 means first entry.
	const canGoBack = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;

	return (
		<div className="relative isolate bg-background pb-24">
			{/* Sticky Back / Share row — used on both native (below safe-area
			    spacer at top: env(safe-area-inset-top)) and web (below the
			    wordmark Header at top: 56px). Same chevron-back + outlined-
			    Share-pill pattern in both contexts so the event detail
			    surface reads identically across the app and browser. */}
			<div
				className="sticky z-40 bg-background"
				style={{ top: "var(--header-h)" }}
			>
				<div className="container flex items-center justify-between py-2">
					{canGoBack ? (
						<button
							onClick={() => navigate(-1)}
							className="inline-flex items-center gap-1 p-2 -ml-2 text-foreground active:opacity-60 hover:opacity-70 transition-opacity"
							aria-label="Back"
						>
							<ChevronLeft className="h-5 w-5" />
							<span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]">Back</span>
						</button>
					) : (
						<div />
					)}
					<button
						onClick={handleShare}
						className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full md:rounded-none border-2 border-foreground text-foreground hover:bg-foreground hover:text-background active:scale-95 active:opacity-80 transition-all"
						aria-label="Share"
					>
						<Share className="h-3.5 w-3.5" />
						<span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]">
							Share
						</span>
					</button>
				</div>
			</div>

			{/* Inline Share in the action row is now redundant on every
			    surface (top bar handles it everywhere) — flag pulled to
			    false unconditionally below. */}
			<EventDetailView
				event={event}
				recurrenceLabel={recurrenceLabel}
				onOpenMaps={handleMaps}
				/* Share moved to the sticky top bar on every surface
				   (web + native), so the inline action-row CTA is off. */
				showShare={false}
				onEdit={canEdit ? () => window.open(`/edit-event/${event.id}`, "_blank", "noopener,noreferrer") : undefined}
			/>
		</div>
	);
}
