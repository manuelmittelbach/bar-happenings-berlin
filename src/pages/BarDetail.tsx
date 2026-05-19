import { useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ChevronLeft, Globe, Instagram } from "lucide-react";
import { motion } from "framer-motion";
import type { BarlinEvent } from "@/types/event";
import { useVenueById, useEventsByVenue } from "@/hooks/useEvents";
import { berlinDateString } from "@/lib/dateFormat";
import { addSoftHyphens } from "@/lib/cleanTitle";
import EventCard from "@/components/events/EventCard";
import { PageSpinner } from "@/components/ui/page-spinner";

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
  const { venue, isLoading } = useVenueById(id || "");
  const todayStr = berlinDateString();
  const { data: venueEvents = [] } = useEventsByVenue(id || "", todayStr);

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
  const handleOpenMaps = () => {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        venue.address || venue.name,
      )}`,
      "_blank",
    );
  };

  return (
    <div className="relative isolate bg-background pb-24">
      {/* Sticky Back row — mirrors EventDetail. No Share on the bar
          surface yet; can be added later if the bar URL becomes a
          shareable object. */}
      <div
        className="sticky z-40 bg-background"
        style={{ top: "var(--header-h)" }}
      >
        <div className="container flex items-center justify-between py-2">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 p-2 -ml-2 text-foreground active:opacity-60 hover:opacity-70 transition-opacity"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]">Back</span>
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

        {/* A. Lede figure — sits between the bar name and the action chip
            row. Acts as a visual signature for the venue without
            dominating the masthead the way a hero image at the very top
            would. Same border + shadow as EventDetail's lede. */}
        {venue.image && (
          <figure className="relative border-2 border-foreground overflow-hidden mb-6 aspect-[3/2] md:aspect-[16/9] shadow-[0_30px_60px_-30px_hsla(18,85%,52%,0.35)]">
            <img
              src={venue.image}
              alt={venue.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </figure>
        )}

        {/* D. Action chip row — Website / Instagram as inline mono caps
            chips matching EventDetail's price/language/recurrence row.
            Soft hairline below closes the row. */}
        {(venue.website || venue.instagram) && (
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
          <button
            onClick={handleOpenMaps}
            className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground active:opacity-70 transition-colors"
          >
            Open in Maps <span aria-hidden="true">→</span>
          </button>
        </section>

        {/* F. About the bar — labelled section so the description reads
            as deliberate editorial copy rather than orphan body text. */}
        {venue.description && (
          <section className="mt-6 pt-4 border-t border-foreground/15">
            <h2 className="heading-editorial text-[22px] md:text-[24px] leading-tight mb-3">
              About the bar
            </h2>
            <div className="font-body text-[17px] md:text-[18px] leading-[1.6] space-y-5">
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
          {upcomingEvents.length === 0 ? (
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

/* UpcomingAgenda — weekday-grouped agenda. Same shape as LaterAgenda on
 * the index page, scoped to a single bar. Each day gets a sticky leaflet
 * with WD / DOM / MON, anchored at the global header bottom (+ a small
 * offset for breathing room). */
interface UpcomingAgendaProps {
  events: BarlinEvent[];
  onEventClick: (id: string) => void;
}

function UpcomingAgenda({ events, onEventClick }: UpcomingAgendaProps) {
  const groups = useMemo(() => {
    const out: { date: string; events: BarlinEvent[] }[] = [];
    for (const e of events) {
      const last = out[out.length - 1];
      if (last && last.date === e.date) last.events.push(e);
      else out.push({ date: e.date, events: [e] });
    }
    return out;
  }, [events]);

  return (
    <div>
      {groups.map((g) => {
        const d = new Date(g.date + "T00:00:00");
        const wdShort = d.toLocaleDateString("en-GB", { weekday: "short" });
        const dom = d.getDate();
        const mon = d.toLocaleDateString("en-GB", { month: "short" });
        return (
          <div
            key={g.date}
            className="flex gap-5 md:gap-7 mt-7 first:mt-0"
          >
            <div className="w-[56px] md:w-[88px] shrink-0 pt-[22px] md:sticky md:top-[80px] md:self-start text-left">
              <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {wdShort}
              </div>
              <div className="font-serif font-bold text-[34px] md:text-[44px] leading-[0.9] mt-0.5">
                {dom}
              </div>
              <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground mt-0.5">
                {mon}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              {g.events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  layout="list"
                  onClick={onEventClick}
                  hideVenue
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
