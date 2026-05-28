import React, { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Pencil, Euro, Repeat, Languages, Clock, Calendar, ChevronRight, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import ShareMenu from "@/components/events/ShareMenu";
import { cleanEventTitle, addSoftHyphens } from "@/lib/cleanTitle";
import type { BarlinEvent } from "@/types/event";
import { useCategories } from "@/hooks/useEvents";


function renderWithLinks(text: string) {
  const urlRegex = /https?:\/\/[^\s]+/g;
  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <a key={match.index} href={match[0]} target="_blank" rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-foreground break-all">
        {match[0]}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export interface EventDetailViewProps {
  // Core event payload. The admin preview synthesizes this from a staged row.
  event: Pick<
    BarlinEvent,
    | "id"
    | "title"
    | "venue"
    | "venueId"
    | "address"
    | "neighborhood"
    | "date"
    | "startTime"
    | "endTime"
    | "doorsTime"
    | "category"
    | "language"
    | "description"
    | "entryInfo"
    | "url"
    | "image"
    | "imagePosition"
    | "status"
    | "canceledBy"
    | "isCommunitySubmission"
  >;

  // Pre-computed recurrence label (e.g. "Every Tuesday"). null = hide.
  recurrenceLabel: string | null;

  // "Open in Maps" handler.
  onOpenMaps: () => void;

  // ShareMenu visibility (admin preview hides it).
  showShare: boolean;

  // Compact = smaller hero, smaller title, no md:-upscales. Used by the
  // admin preview which renders inside a narrow column on wide viewports.
  compact?: boolean;

  // Optional banner rendered above the article (admin preview uses this
  // for the "Live preview" strip).
  headerBanner?: ReactNode;

  // Admin-only edit shortcut. When provided, renders a pencil button in
  // the hero (or eyebrow row when there's no hero image).
  onEdit?: () => void;
}

export default function EventDetailView({
  event,
  recurrenceLabel,
  onOpenMaps,
  showShare,
  compact = false,
  headerBanner,
  onEdit,
}: EventDetailViewProps) {
  const displayTitle = cleanEventTitle(event.title || "(untitled)", event.venue);
  const hasRealImage = !!event.image;
  const { data: categories = [] } = useCategories();
  const categoryInfo = categories.find((c) => c.id === event.category);
  const categoryColor = categoryInfo?.color;
  const categoryLabel = categoryInfo?.label ?? event.category;
  const isCanceled = event.status === "canceled";
  const canceledLabel = event.canceledBy === "admin" ? "Canceled" : "Canceled by the organizer";

  // Strip € from price text since the Euro icon already conveys it.
  // When entry info is missing (admin picked "Check at the door", or the
  // scraper couldn't parse a price from the source), fall back to
  // "Check at the door" — gives the user an actionable cue instead of
  // hiding the chip and leaving them guessing whether it's free.
  const priceText = event.entryInfo?.replace(/€/g, "");
  const detailItems: { icon: LucideIcon; text: string }[] = [
    { icon: Euro, text: priceText || "Check at the door" },
    recurrenceLabel ? { icon: Repeat, text: recurrenceLabel } : null,
    event.language ? { icon: Languages, text: `in ${event.language}` } : null,
  ].filter((x): x is { icon: LucideIcon; text: string } => x !== null);

  const eyebrowTime = event.startTime
    ? `${event.startTime}${event.endTime ? `–${event.endTime}` : ""}`
    : "Unknown";
  const eyebrowDate = event.date
    ? new Date(event.date + "T00:00:00Z").toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      })
    : null;
  // Each eyebrow part carries its own glyph: category renders as a
  // filled colored dot (echoes the wordmark accent), time gets a Clock,
  // date gets a Calendar. Makes the row scannable when the time string
  // is long ("Unknown") and prevents Date/Time from blurring
  // into each other as two mono-caps fragments.
  const eyebrowColor = categoryColor || "hsl(var(--accent))";
  type EyebrowPart =
    | { kind: "category"; text: string }
    | { kind: "time" | "date"; icon: LucideIcon; text: string };
  const eyebrowParts: EyebrowPart[] = [
    { kind: "category" as const, text: categoryLabel },
    eyebrowTime ? { kind: "time" as const, icon: Clock, text: eyebrowTime } : null,
    eyebrowDate ? { kind: "date" as const, icon: Calendar, text: eyebrowDate } : null,
  ].filter((x): x is EyebrowPart => x !== null);

  const titleStyle: React.CSSProperties = {
    // clamp(26px, 4.5vw, 40px) — pulled back from the previous
    // (28px, 5vw, 48px) range so the H1 reads as a magazine article
    // headline rather than a billboard. 40px cap is in the Pitchfork /
    // The Verge zone; 26px floor still keeps long German compounds on
    // two lines on 375px phones. Venue H3 ratio stays healthy.
    fontSize: compact ? "clamp(22px, 5vw, 30px)" : "clamp(26px, 4.5vw, 40px)",
  };

  const articlePadding = compact ? "p-4" : "px-6 pt-8 pb-16 md:px-8";
  const articleWidth = compact ? "max-w-full" : "max-w-[880px] mx-auto";

  return (
    <div className="text-foreground">
      {headerBanner}

      <article className={`${articleWidth} ${articlePadding}`}>
        {/* B. Eyebrow row — category color · date · time, with overlays
            relocated here when the lede figure is absent. Bumped to
            13/14px (was 11px) so the byline reads as a proper meta row
            on the detail surface instead of a tight micro-caption.
            All parts share the category hue: the colour is the byline's
            visual signature on a per-event basis, and splitting it across
            black/gray/colour drained the page's warmth without enough
            hierarchy gain to justify the cost. */}
        {!hasRealImage && isCanceled && (
          <div className="mb-3">
            <span className="inline-block font-mono font-bold text-xs uppercase tracking-[0.06em] text-destructive border-2 border-destructive px-2.5 py-0.5 -rotate-3 whitespace-nowrap">
              {canceledLabel}
            </span>
          </div>
        )}
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex-1 min-w-0 font-mono text-[13px] md:text-[14px] font-bold uppercase tracking-[0.14em] flex items-center gap-4 flex-wrap"
            style={{ color: eyebrowColor }}
          >
            {eyebrowParts.map((part, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                {part.kind !== "category" && (
                  <part.icon className="h-3.5 w-3.5 shrink-0" />
                )}
                <span>{part.text}</span>
              </span>
            ))}
            {event.isCommunitySubmission && (
              <span className="inline-block px-1.5 py-0.5 border border-current text-muted-foreground tracking-[0.1em] text-[10px] font-bold uppercase">
                Community submission
              </span>
            )}
          </div>
          {!hasRealImage && onEdit && (
            <button
              onClick={onEdit}
              aria-label="Edit event"
              className="shrink-0 h-9 w-9 flex items-center justify-center rounded-full border-2 border-foreground text-foreground hover:bg-accent hover:text-accent-foreground hover:border-accent transition-colors active:scale-95"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* C. Display title — Syne 800, fluid magazine-masthead size.
            Two-pronged hyphenation: `addSoftHyphens` pre-inserts soft
            hyphens at CamelCase boundaries so mashed-up titles like
            "JazzformationJustFriends" can split into their word
            components, and `hyphens-auto` lets the browser also break
            dictionary words at proper syllable boundaries via the
            inherited `lang="en"` on <html>. Trade-off: proper names
            ("LUKASHEVA") can occasionally get awkward dictionary splits
            ("LU-KASHEVA"). Accepted for the much more common case of
            long German/English compounds that otherwise overflow. */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="font-serif font-bold tracking-[-0.02em] leading-[0.95] mb-6 break-words hyphens-auto"
          style={titleStyle}
        >
          {addSoftHyphens(displayTitle)}
        </motion.h1>

        {/* D. Action row — Share primary CTA on the left, metadata chips on
            the right. Softer hairline rule (foreground/15) instead of the
            old 2px black bar — matches the calmer atmosphere on the rest
            of the page. */}
        {(showShare || detailItems.length > 0) && (
          <div className="flex items-center gap-3 flex-wrap pb-3 border-b border-foreground/15">
            {showShare && (
              <ShareMenu eventTitle={displayTitle} eventId={event.id} variant="primary-cta" />
            )}
            {/* Detail chips (Entry · Language · Recurrence) sit
                left-aligned. Previously a flex-1 spacer pushed them to
                the right edge so they framed the Share CTA on the
                left, but in native context Share moved to the top bar
                and the chips ended up orphaned on the right with all
                whitespace before them. Left-aligned reads as a proper
                meta row below the title. */}
            {detailItems.length > 0 && (
              <div className="flex items-center gap-4 flex-wrap font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {detailItems.map((item, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.text}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* E. Venue block — compact info stack (Resident Advisor style).
            No section eyebrow, no display-heading-sized venue name —
            the venue name reads as a tight bold body line (DM Sans bold
            ~18px), address below in muted body, and the maps affordance
            drops to a small accent text link. Saves a lot of vertical
            real estate while keeping the data scan-able. The mobile-
            wide overlay still routes to the bar page; the inline maps
            link uses z-20 to stay clickable above it. */}
        <section className="mt-4 relative">
          {event.venueId && (
            <Link
              to={`/bar/${event.venueId}`}
              aria-label={`Open ${event.venue} page`}
              className="md:hidden absolute inset-0 z-10"
            />
          )}
          {/* Flex wrapper so a Resident-Advisor-style chevron can sit on
              the right of the venue stack, telegraphing that the whole
              block is tappable on mobile. Without the chevron the
              absolute-inset link is invisible and users don't realise
              they can drill into the bar page from here. */}
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              {event.venueId ? (
                <Link
                  to={`/bar/${event.venueId}`}
                  lang="de"
                  className={`font-body block leading-tight break-words text-foreground hover:text-accent transition-colors no-underline ${compact ? "text-[17px]" : "text-[18px] md:text-[20px]"} font-bold`}
                >
                  {event.venue}
                </Link>
              ) : (
                <h3
                  lang="de"
                  className={`font-body leading-tight break-words ${compact ? "text-[17px]" : "text-[18px] md:text-[20px]"} font-bold`}
                >
                  {event.venue}
                </h3>
              )}
              {event.address && (
                <p className="mt-0.5 font-body text-[14px] text-muted-foreground leading-snug">
                  {event.address.replace(/,\s*(Germany|Deutschland)\s*$/i, "")}
                </p>
              )}
              <button
                onClick={onOpenMaps}
                className="relative z-20 mt-2 inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground active:opacity-70 transition-colors"
              >
                Open in Maps <span aria-hidden="true">→</span>
              </button>
            </div>
            {event.venueId && (
              <ChevronRight
                aria-hidden
                className="md:hidden shrink-0 h-6 w-6 text-muted-foreground"
              />
            )}
          </div>
        </section>

        {/* Lede figure — moved out of the article top into this slot
            (between the venue block and the About section). Acts as an
            editorial divider: visual break before the descriptive copy
            starts, keeping the masthead + chip + venue stack at the top
            cleanly typographic when an event has a photo. */}
        {hasRealImage && (
          <figure className={`relative border-2 border-foreground overflow-hidden mt-6 aspect-[3/2] shadow-[0_30px_60px_-30px_hsla(18,85%,52%,0.35)] ${compact ? "" : "md:aspect-[16/9]"}`}>
            <img
              src={event.image!}
              alt={displayTitle}
              style={{ objectPosition: event.imagePosition }}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {isCanceled && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <span className="inline-block font-mono font-bold text-xs md:text-sm uppercase tracking-[0.06em] text-destructive border-2 border-destructive px-3 py-1 bg-background/85 -rotate-3 whitespace-nowrap">
                  {canceledLabel}
                </span>
              </div>
            )}
            {onEdit && (
              <button
                onClick={onEdit}
                aria-label="Edit event"
                className="absolute top-3 right-3 z-10 h-9 w-9 flex items-center justify-center rounded-full bg-background/85 backdrop-blur-sm border-2 border-foreground text-foreground hover:bg-accent hover:text-accent-foreground hover:border-accent transition-colors active:scale-95"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </figure>
        )}

        {/* F. About the event — labelled section so the description reads
            as deliberate editorial copy rather than orphan body text.
            Hairline above separates it visually from the venue section.
            The Event link sits inside this section as a mono-caps row
            (matches the Open-in-Maps row grammar). */}
        <section className="mt-6 pt-4 border-t border-foreground/15">
          <h2 className="heading-editorial text-[22px] md:text-[24px] leading-tight mb-3">
            About the event
          </h2>
          {/* Doors as the first line under the section heading — pairs
              with the descriptive copy below as practical "what time to
              show up" context. Hidden when it equals startTime (the
              eyebrow time already conveys that, so it would duplicate). */}
          {!!event.doorsTime && event.doorsTime !== event.startTime && (
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Doors {event.doorsTime}
            </p>
          )}
          <DescriptionBlock
            description={event.description ?? ""}
            compact={compact}
            eventUrl={event.url ?? undefined}
          />
        </section>

        <div className="h-6" />
      </article>
    </div>
  );
}

/* Description block with optional "Show more" toggle. Short descriptions
   render in full. Long ones (over the character threshold) are clipped
   with a soft fade at the bottom and a mono caps toggle button — same
   "Read more on Medium / Instagram caption truncate" pattern users
   already know, no learning curve. */
function DescriptionBlock({
  description,
  compact,
  eventUrl,
}: {
  description: string;
  compact: boolean;
  eventUrl?: string;
}) {
  // Small accent text link — matches the compact "Open in Maps" inline
  // link grammar in the venue section, no chrome/icon/chevron stack.
  const eventLinkEl = eventUrl ? (
    <a
      href={eventUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground active:opacity-70 transition-colors"
    >
      Event link <span aria-hidden="true">→</span>
    </a>
  ) : null;

  if (!description) {
    return (
      <div className={`font-body ${compact ? "text-[15px]" : "text-[17px] md:text-[18px]"} leading-[1.6] max-w-[65ch]`}>
        <p className="italic text-muted-foreground/70 text-sm">(no description)</p>
        {eventLinkEl && <div>{eventLinkEl}</div>}
      </div>
    );
  }

  return (
    <div className={`font-body ${compact ? "text-[15px]" : "text-[17px] md:text-[18px]"} leading-[1.6] max-w-[65ch]`}>
      <div className="space-y-5">
        {description.split("\n\n").map((p, i) => (
          <p key={i}>{renderWithLinks(p)}</p>
        ))}
      </div>
      {eventLinkEl && <div>{eventLinkEl}</div>}
    </div>
  );
}


