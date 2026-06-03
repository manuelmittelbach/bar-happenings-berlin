import { useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ChevronLeft, Globe, Instagram, Phone, Share } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Share as CapacitorShare } from "@capacitor/share";
import { useVenueById, useEventsByVenue } from "@/hooks/useEvents";
import { useIsNative } from "@/hooks/useIsNative";
import { berlinDateString } from "@/lib/dateFormat";
import { addSoftHyphens } from "@/lib/cleanTitle";
import UpcomingAgenda from "@/components/bars/UpcomingAgenda";
import { PageSpinner } from "@/components/ui/page-spinner";

// Production origin for share links. Mirrors EventDetail — keeping it
// local to each detail surface (instead of a shared constant) keeps the
// share affordance self-contained.
const PUBLIC_ORIGIN = "https://insidebars.co";

/* BarDetail — magazine layout matched to EventDetailView's editorial
 * language: sticky Back top bar, warm radial atmosphere disks, mixed-case
 * Syne masthead with soft hyphenation, mono-caps eyebrow + chip rows, and
 * soft hairlines (foreground/15) separating semantic sections. The bar
 * still exposes the things only a bar surface offers — Website /
 * Instagram links, the upcoming-events agenda — but they sit inside the
 * same chrome rhythm as event detail so the two pages read as related
 * editorial surfaces.
 */
export default function BarDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNative = useIsNative();
  const { venue, isLoading } = useVenueById(id || "");
  const todayStr = berlinDateString();
  const { data: venueEvents = [], isLoading: eventsLoading } = useEventsByVenue(id || "", todayStr);
  // Re-entrancy guard — see EventDetail. Stops a fast double-tap from
  // re-invoking the share sheet and falling through to a bogus
  // "Link copied!" toast.
  const isSharingRef = useRef(false);

  // Hide Back when this tab has no prior history (e.g. opened via
  // target="_blank" from the dashboard's View link) — a non-functional
  // Back button there is more confusing than helpful. React Router v6
  // tracks position via history.state.idx; idx === 0 means first entry.
  const canGoBack = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;

  if (isLoading) return <PageSpinner />;

  if (!venue) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background px-6 text-center">
        <h1 className="font-body text-2xl font-bold">Bar not found</h1>
        <Link to="/" className="text-sm text-accent mt-2 inline-block">
          Back to home
        </Link>
      </div>
    );
  }

  const upcomingEvents = venueEvents
    .filter((e) => e.status !== "canceled" && e.date >= todayStr)
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      const tA = a.startTime || "99:99";
      const tB = b.startTime || "99:99";
      return tA.localeCompare(tB);
    });

  const cleanAddress = venue.address.replace(/,\s*(Germany|Deutschland)\s*$/i, "");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address || venue.name)}`;
  // Hybrid Open-in-Maps (see EventDetailView): real <a> for long-press /
  // new-tab, but a normal tap routes through window.open for the cleaner
  // redirect on both mobile web and the Capacitor app.
  const openMaps = (e: React.MouseEvent) => {
    e.preventDefault();
    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  };
  // Share — mirrors EventDetail's handler. Native iOS routes through
  // Capacitor's Share plugin (real UIActivityViewController), web uses
  // navigator.share when available, and everything else falls back to
  // clipboard. The shared URL always points at the public origin so a
  // recipient can open it without our app installed.
  const handleShare = async () => {
    // Ignore rapid double-taps while a share sheet is already opening.
    if (isSharingRef.current) return;
    isSharingRef.current = true;
    try {
      const url = `${PUBLIC_ORIGIN}/bar/${venue.id}`;
      const title = venue.name || "Inside Bars";
      if (isNative) {
        try {
          await CapacitorShare.share({ title, url, dialogTitle: "Share bar" });
        } catch (err) {
          // Dismissed or concurrent share → silent. Do NOT fall through to
          // clipboard on native: the share sheet is always available, so a
          // failure means "don't copy", not the spurious "Link copied!".
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
      // Web fallback only: clipboard.
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

  return (
    <div className="relative isolate bg-background pb-24">
      {/* Sticky Back / Share row — mirrors EventDetail exactly. Share
          opens the native share sheet on iOS, navigator.share on capable
          web, clipboard fallback otherwise. Back is hidden when there's
          no in-app history (e.g. opened in a new tab from the bar-owner
          dashboard's "View" link) — `navigate(-1)` would close the tab. */}
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

      <article className="max-w-[880px] mx-auto px-6 pt-4 pb-16 md:px-8">
        {/* C. Display title — Syne 800, fluid masthead size, mixed case
            (was uppercase before; aligning to EventDetail's title style).
            Soft hyphens at CamelCase boundaries + browser hyphenation via
            `hyphens-auto` (German dictionary via lang="de") so long
            compound bar names break gracefully. */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          lang="de"
          className="font-serif font-bold tracking-[-0.02em] leading-[0.95] mb-6 break-words hyphens-auto"
          style={{ fontSize: "clamp(26px, 4.5vw, 40px)" }}
        >
          {addSoftHyphens(venue.name)}
        </motion.h1>

        {/* D. Action chip row — Website / Instagram as inline mono caps
            chips matching EventDetail's price/language/recurrence row.
            Soft hairline below closes the row. */}
        {(venue.website || venue.instagram || venue.phone) && (
          <div className="flex items-center gap-4 flex-wrap pb-3 border-b border-foreground/15 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {venue.website && (
              <a
                href={venue.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <Globe className="h-3.5 w-3.5 shrink-0" />
                <span>Website</span>
                <span aria-hidden="true">→</span>
              </a>
            )}
            {venue.instagram && (
              <a
                href={venue.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <Instagram className="h-3.5 w-3.5 shrink-0" />
                <span>Instagram</span>
                <span aria-hidden="true">→</span>
              </a>
            )}
            {venue.phone && (
              <a
                href={`tel:${venue.phone.replace(/\s+/g, "")}`}
                className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors normal-case tracking-normal text-[12px]"
              >
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>{venue.phone}</span>
                <span aria-hidden="true">→</span>
              </a>
            )}
          </div>
        )}

        {/* E. Address block — compact info stack (RA style), same shape
            as EventDetail's venue section but flipped: we're already on
            the bar page, so the venue name is the title above, and this
            row carries the address + maps affordance only. */}
        <section className="mt-4">
          {cleanAddress && (
            <p lang="de" className="font-body text-[14px] text-muted-foreground leading-snug">
              {cleanAddress}
            </p>
          )}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={openMaps}
            className="mt-2 inline-flex w-fit items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground active:opacity-70 transition-colors no-underline"
          >
            Open in Maps <span aria-hidden="true">→</span>
          </a>
        </section>

        {/* F. About the bar — labelled section so the description reads
            as deliberate editorial copy rather than orphan body text. */}
        {venue.description && (
          <section className="mt-6 pt-4 border-t border-foreground/15">
            <h2 className="heading-editorial text-[22px] md:text-[24px] leading-tight mb-3">
              About the bar
            </h2>
            <div className="font-body text-[17px] md:text-[18px] leading-[1.6] space-y-5 max-w-[65ch]">
              {venue.description.split("\n\n").map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        )}

        {/* G. Upcoming events — labelled section heading + the weekday-
            grouped agenda. Same heading typography as About so the two
            sections share rhythm. */}
        <section className="mt-6 pt-4 border-t border-foreground/15">
          <h2 className="heading-editorial text-[22px] md:text-[24px] leading-tight mb-3">
            Upcoming events
          </h2>
          {/* While the events fetch is still in flight render nothing —
              showing the empty-state copy during initial load briefly
              flashes "Nothing on the calendar yet" even for bars that
              do have events. Only commit to the empty state after the
              query resolves. */}
          {eventsLoading ? (
            <div className="py-4 h-12" aria-hidden />
          ) : upcomingEvents.length === 0 ? (
            <p className="font-body italic text-[16px] text-muted-foreground py-4 m-0">
              Nothing on the calendar yet. Check back soon.
            </p>
          ) : (
            <UpcomingAgenda
              events={upcomingEvents}
              onEventClick={(eventId) => navigate(`/event/${eventId}`)}
            />
          )}
        </section>
      </article>
    </div>
  );
}

