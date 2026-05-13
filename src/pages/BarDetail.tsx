import { useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { MapPin, Globe, Instagram } from "lucide-react";
import { motion } from "framer-motion";
import type { BarlinEvent } from "@/types/event";
import { useVenueById, useEventsByVenue } from "@/hooks/useEvents";
import { berlinDateString } from "@/lib/dateFormat";
import EventCard from "@/components/events/EventCard";
import { PageSpinner } from "@/components/ui/page-spinner";

/* BarDetail — editorial magazine layout for a single bar, mirroring the
 * EventDetailView rhythm: eyebrow + masthead title + meta row + bordered
 * sections. The "upcoming events at this bar" list replaces what used to
 * be the "All events at this bar" toggle on the event-detail page, so
 * the bar becomes its own first-class object (with room to grow:
 * description, photo, opening hours, reviews — none of which fit on an
 * event-detail tab).
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
    <div className="bg-background pb-24">
      <article className="max-w-[880px] mx-auto px-6 pt-8 pb-16 md:px-8">
        {/* Lede figure when a venue photo exists. Mirrors the event-detail
            hero ratio so the visual rhythm carries across surfaces. */}
        {venue.image && (
          <figure className="relative border-2 border-foreground overflow-hidden mb-6 aspect-[3/2] md:aspect-[16/9]">
            <img
              src={venue.image}
              alt={venue.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </figure>
        )}

        {/* Masthead title — same typographic system as event titles, but
            uppercased so a bar and an event read as related-but-distinct
            magazine surfaces. */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          lang="de"
          className="font-heading font-extrabold tracking-[-0.02em] leading-[0.95] uppercase mb-6 hyphens-auto break-words"
          style={{ fontSize: "clamp(28px, 5vw, 48px)" }}
        >
          {venue.name}
        </motion.h1>

        {/* Action row — Open in Maps primary on the left, address +
            neighborhood right-aligned on the right (pairs naturally with
            the Maps CTA since both answer "where"). 2px foreground
            bottom rule closes the row. */}
        <div className="flex items-stretch gap-4 pb-6 border-b-2 border-foreground">
          <button
            onClick={handleOpenMaps}
            className="inline-flex items-center gap-2 h-12 px-6 bg-accent text-accent-foreground font-mono text-xs font-bold uppercase tracking-[0.08em] hover:bg-accent/90 active:scale-[0.98] transition-all duration-200"
          >
            <MapPin className="h-3.5 w-3.5" />
            Open in Maps
          </button>
          <div className="flex-1 min-w-0 flex flex-col justify-center items-end font-body text-[13px] md:text-[14px] text-muted-foreground leading-[1.3]">
            {/* items-end + text-left lässt den Block rechts andocken und
                trotzdem links bündig brechen: wenn die ganze Adresse in
                eine Zeile passt, schrumpft der Span auf Content-Breite
                und wirkt rechtsbündig; wenn nicht, wächst er bis zur
                Container-Breite und PLZ + Stadt + Neighborhood fallen
                gemeinsam auf eine zweite Zeile, linksbündig zur Straße.
                Neighborhood hängt mit " · " an die Stadt — bricht
                natürlich am Komma-Whitespace. */}
            <span className="text-left max-w-full">
              {cleanAddress}
              {venue.neighborhood && (
                <span className="opacity-80"> · {venue.neighborhood}</span>
              )}
            </span>
          </div>
        </div>

        {/* External links — Website + Instagram side-by-side outline
            buttons, mirroring the "Open in Google Maps" / "All events at
            this bar" pair on the event-detail venue block. Lives just
            below the action rule so it reads as a secondary CTA row. */}
        {(venue.website || venue.instagram) && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {venue.website && (
              <a
                href={venue.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 h-[38px] px-4 border-2 border-foreground bg-transparent text-foreground font-mono text-[11px] font-bold uppercase tracking-[0.1em] hover:bg-foreground hover:text-background transition-colors active:scale-[0.98]"
              >
                <Globe className="h-3.5 w-3.5" />
                Website
              </a>
            )}
            {venue.instagram && (
              <a
                href={venue.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 h-[38px] px-4 border-2 border-foreground bg-transparent text-foreground font-mono text-[11px] font-bold uppercase tracking-[0.1em] hover:bg-foreground hover:text-background transition-colors active:scale-[0.98]"
              >
                <Instagram className="h-3.5 w-3.5" />
                Instagram
              </a>
            )}
          </div>
        )}

        {/* Optional description block, magazine-prose-style. */}
        {venue.description && (
          <div className="mt-8 font-body text-[17px] md:text-[18px] leading-[1.6] space-y-5">
            {venue.description.split("\n\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}

        {/* Upcoming events — grouped by weekday, mirrors the Later-section
            on /. Each date gets its own sticky weekday header (weekday +
            DOM Month + count) over the hairline, then the events of that
            day. Sticky headers anchor at `top-[64px]` (just the global
            header) because BarDetail has no category-filter chrome to
            account for. */}
        <section className="mt-10">
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

/* UpcomingAgenda — same weekday-grouped layout as LaterAgenda on the
 * Index page, scoped to a single bar. Each day gets a sticky header
 * with the weekday name + DOM Month + event count, anchored at the
 * global header bottom (top-[64px]) since BarDetail has no category
 * filter chrome. */
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
            {/* Date leaflet — WD / DOM / MON, left-aligned. The mono caps
                (WD, MON) inherit the same line-height as the EventMeta
                eyebrow on the events column, so the WD caps and the
                eyebrow row sit on the same baseline. pt-4 matches the
                EventCard's py-4. Sticky on md+ so the date stays glued
                to the top while scrolling a multi-event day. */}
            <div className="w-[56px] md:w-[88px] shrink-0 pt-[22px] md:sticky md:top-[80px] md:self-start text-left">
              <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {wdShort}
              </div>
              <div className="font-heading font-extrabold text-[34px] md:text-[44px] leading-[0.9] mt-0.5">
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
