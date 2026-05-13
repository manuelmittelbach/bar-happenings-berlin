import React, { ReactNode, Fragment, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, ExternalLink, Pencil, Euro, Repeat, Languages, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import ShareMenu from "@/components/events/ShareMenu";
import { formatDateWithDay } from "@/lib/dateFormat";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { endsNextDay } from "@/lib/eventStatus";
import type { BarlinEvent } from "@/types/event";
import { useCategories, useVenueById } from "@/hooks/useEvents";


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
    : null;
  const eyebrowDate = event.date ? formatDateWithDay(event.date) : null;
  const eyebrowParts = [categoryLabel, eyebrowDate, eyebrowTime].filter(Boolean) as string[];
  const eyebrowColor = categoryColor || "hsl(var(--accent))";

  // Venue thumbnail. Loaded via the shared venues cache (no extra
  // request when the page already touched a venue list), null when the
  // venue has no image set or there's no venueId to look up.
  const { venue: venueDetails } = useVenueById(event.venueId ?? "");
  const venueImage = venueDetails?.image || null;

  const titleStyle: React.CSSProperties = {
    // clamp(28px, 5vw, 48px) — editorial-magazine sizing range, not
    // marketing-hero. 28px floor keeps long German compounds on two
    // lines on 375px phones; 48px cap (was 60px) lands in the same
    // range as The Verge / Pitchfork article headlines, so the title
    // reads as "long-form" rather than "billboard" on wide viewports.
    // The 5vw curve scales gently between the two so tablets don't
    // overshoot. Venue ratio stays healthy at 1.4×–1.85× across all
    // viewports — no need to adjust the H3 sibling.
    fontSize: compact ? "clamp(22px, 5vw, 30px)" : "clamp(28px, 5vw, 48px)",
  };

  const articlePadding = compact ? "p-4" : "px-6 pt-8 pb-16 md:px-8";
  const articleWidth = compact ? "max-w-full" : "max-w-[880px] mx-auto";

  return (
    <div className="text-foreground">
      {headerBanner}

      <article className={`${articleWidth} ${articlePadding}`}>
        {/* A. Lede figure — magazine top photo when an image is available. */}
        {hasRealImage && (
          <figure className={`relative border-2 border-foreground rounded-2xl md:rounded-3xl overflow-hidden mb-6 aspect-[3/2] shadow-[0_30px_60px_-30px_hsla(18,85%,52%,0.35)] ${compact ? "" : "md:aspect-[16/9]"}`}>
            <img
              src={event.image!}
              alt={displayTitle}
              style={{ objectPosition: event.imagePosition }}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {isCanceled && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <span className="inline-block font-heading font-bold text-xs md:text-sm uppercase tracking-[0.06em] text-destructive border-2 border-destructive rounded-md px-3 py-1 bg-background/85 -rotate-3 whitespace-nowrap">
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

        {/* B. Eyebrow row — category color · date · time, with overlays
            relocated here when the lede figure is absent. Bumped to
            13/14px (was 11px) so the byline reads as a proper meta row
            on the detail surface instead of a tight micro-caption. */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex-1 min-w-0 font-mono text-[13px] md:text-[14px] font-bold uppercase tracking-[0.14em] flex items-center gap-2 flex-wrap"
            style={{ color: eyebrowColor }}
          >
            {eyebrowParts.map((part, i) => (
              <Fragment key={i}>
                {i > 0 && <span className="opacity-60">·</span>}
                <span>{part}</span>
              </Fragment>
            ))}
          </div>
          {!hasRealImage && isCanceled && (
            <span className="shrink-0 inline-block font-heading font-bold text-xs uppercase tracking-[0.06em] text-destructive border-2 border-destructive rounded-md px-2.5 py-0.5 -rotate-3 whitespace-nowrap">
              {canceledLabel}
            </span>
          )}
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
            No `hyphens-auto` here: event titles are typically proper
            names + mixed languages ("TAMARA LUKASHEVA // DUO ...") where
            German hyphenation rules produced ugly mid-name splits
            ("LU-KASHEVA"). `break-words` stays so a single
            extra-long compound noun still wraps before overflowing the
            viewport, but normal word boundaries are preferred. */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="font-heading font-extrabold tracking-[-0.02em] leading-[0.95] mb-6 break-words"
          style={titleStyle}
        >
          {displayTitle}
        </motion.h1>

        {/* D. Action row — Share primary CTA on the left, metadata chips on
            the right. Softer hairline rule (foreground/15) instead of the
            old 2px black bar — matches the calmer atmosphere on the rest
            of the page. */}
        {(showShare || detailItems.length > 0) && (
          <div className="flex items-center gap-3 flex-wrap pb-6 border-b border-foreground/15">
            {showShare && (
              <ShareMenu eventTitle={displayTitle} eventId={event.id} variant="primary-cta" />
            )}
            <span className="flex-1" />
            {detailItems.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {detailItems.map((item, i) => (
                  <Fragment key={i}>
                    {i > 0 && <span className="opacity-60">·</span>}
                    <span className="inline-flex items-center gap-1.5">
                      <item.icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{item.text}</span>
                    </span>
                  </Fragment>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Doors / next-day microcopy lives just under the action row.
            Hide doors when it equals the start time — the eyebrow already
            shows that time, so a duplicate "Doors 20:00" line would just
            add visual noise. */}
        {(() => {
          const showDoors = !!event.doorsTime && event.doorsTime !== event.startTime;
          const showEndsNextDay = !!event.startTime && endsNextDay(event.startTime, event.endTime);
          if (!showDoors && !showEndsNextDay) return null;
          return (
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              {showDoors && <>Doors {event.doorsTime}</>}
              {showDoors && showEndsNextDay && " · "}
              {showEndsNextDay && <>Ends next day</>}
            </p>
          );
        })()}

        {/* E. Description — DM Sans 17/18px, generous leading.
            Long descriptions get collapsed behind a "Show more" toggle so
            the venue card + maps CTA stay reachable without a long scroll.
            Threshold is character-count based: anything under ~240 chars
            fits in the collapsed window anyway, so we skip the toggle
            entirely for short copy. */}
        <DescriptionBlock description={event.description ?? ""} compact={compact} />


        {/* F. Venue block — rounded editorial card with the Open in
            Maps action. The venue name links out to the bar's own
            detail page (which carries the upcoming-events list that
            used to live behind the "All events at this bar" toggle).
            On mobile the whole card is a tap target for the bar page
            (via an absolute overlay link below) since narrow viewports
            make precise taps on the inline venue-name link awkward.
            Solid bg-background + warm shadow lift the card off the
            atmospheric wash so it reads as a distinct surface without
            the harsh 2px black square it used to be. */}
        <div className="mt-10 border-2 border-foreground rounded-2xl md:rounded-3xl bg-background p-5 md:p-6 relative shadow-[0_24px_60px_-32px_hsla(18,85%,52%,0.3)]">
          {/* Mobile-only overlay that turns the entire card into a tap
              area for the bar page. Hidden on md+ so the desktop hover
              flow (inline venue-name link + maps button) reads cleanly.
              The Open-in-Maps button below uses relative z-20 to stay
              clickable above this overlay. */}
          {event.venueId && (
            <Link
              to={`/bar/${event.venueId}`}
              aria-label={`Open ${event.venue} page`}
              className="md:hidden absolute inset-0 z-10"
            />
          )}
          <div className={venueImage ? "flex gap-4 md:gap-5 items-start" : ""}>
            {/* Bordered thumbnail of the venue, left of the text block.
                Same 2px foreground border as the rest of the bordered
                surfaces so it reads as part of the same family. Square
                aspect, shrink-0 so it doesn't collapse on narrow
                phones. Hidden entirely when the venue has no image
                (most bars right now) — keeps the full-width text
                layout intact for the unfilled case. */}
            {venueImage && (
              <div className="shrink-0 w-[96px] h-[96px] md:w-[140px] md:h-[140px] rounded-xl md:rounded-2xl border-2 border-foreground overflow-hidden">
                <img
                  src={venueImage}
                  alt={event.venue}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className={venueImage ? "flex-1 min-w-0" : ""}>
              <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-1.5">
                The venue
              </div>
              {/* Venue name links to the bar's own detail page. Desktop
                  hover flips to the accent orange — same affordance
                  language as other inline links (Open in Maps, event
                  link footer) so it reads as clickable without
                  underline noise. Falls back to a plain h3 when no
                  venueId is set (legacy / orphan rows). */}
              {event.venueId ? (
                <Link
                  to={`/bar/${event.venueId}`}
                  lang="de"
                  className={`block font-heading font-extrabold uppercase tracking-[-0.01em] hyphens-auto break-words text-foreground hover:text-accent transition-colors no-underline ${compact ? "text-[20px]" : "text-[20px] md:text-[26px]"}`}
                >
                  {event.venue}
                </Link>
              ) : (
                <h3
                  lang="de"
                  className={`font-heading font-extrabold uppercase tracking-[-0.01em] hyphens-auto break-words ${compact ? "text-[20px]" : "text-[20px] md:text-[26px]"}`}
                >
                  {event.venue}
                </h3>
              )}
              {event.address && (
                <p className="mt-2 font-body text-sm text-muted-foreground">
                  {event.address.replace(/,\s*(Germany|Deutschland)\s*$/i, "")}
                </p>
              )}
              {event.neighborhood && (
                <p className="mt-1 font-body text-sm text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {event.neighborhood}
                </p>
              )}
              <div className="mt-4 flex items-center gap-2 flex-wrap relative z-20">
                <button
                  onClick={onOpenMaps}
                  className="inline-flex items-center gap-2 h-[38px] px-4 rounded-full border-2 border-foreground bg-transparent text-foreground font-mono text-[11px] font-bold uppercase tracking-[0.1em] hover:bg-foreground hover:text-background transition-colors active:scale-[0.98]"
                >
                  Open in Maps <span aria-hidden="true">›</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* G. Event link — full-width rounded footer button. Soft accent
            shadow echoes the venue card so the two surfaces feel related. */}
        {event.url && (
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 w-full inline-flex items-center justify-between h-12 px-5 rounded-2xl border-2 border-foreground bg-background text-foreground font-mono text-[11px] font-bold uppercase tracking-[0.12em] hover:bg-foreground hover:text-background transition-colors shadow-[0_18px_40px_-28px_hsla(18,85%,52%,0.3)]"
          >
            <span className="inline-flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Event link
            </span>
            <span aria-hidden="true">›</span>
          </a>
        )}

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
}: {
  description: string;
  compact: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  // 240 chars ≈ 5–6 lines at text-[17px] on mobile. Below this the
  // collapsed window would already show the whole thing, so the toggle
  // would be pointless.
  const TRUNCATE_AT = 240;
  const isLong = description.length > TRUNCATE_AT;
  const showCollapsed = isLong && !expanded;
  // Remember the viewport-relative position of the toggle button when
  // expanding, so collapsing can scroll the page back to that same spot.
  // Without this, "Show less" leaves the user stranded far below where
  // they originally clicked "Show more".
  const expandAnchorRef = useRef<number | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const handleToggle = () => {
    if (!expanded) {
      expandAnchorRef.current = buttonRef.current?.getBoundingClientRect().top ?? null;
      setExpanded(true);
    } else {
      const anchor = expandAnchorRef.current;
      setExpanded(false);
      if (anchor != null) {
        requestAnimationFrame(() => {
          const currentTop = buttonRef.current?.getBoundingClientRect().top ?? 0;
          window.scrollBy({ top: currentTop - anchor, behavior: "auto" });
        });
      }
      expandAnchorRef.current = null;
    }
  };

  if (!description) {
    return (
      <div className={`mt-7 font-body ${compact ? "text-[15px]" : "text-[17px] md:text-[18px]"} leading-[1.6]`}>
        <p className="italic text-muted-foreground/70 text-sm">(no description)</p>
      </div>
    );
  }

  // Fade the text itself via mask-image instead of overlaying an opaque
  // gradient stripe. The old overlay used `from-background` which painted
  // a solid cream block over the last 64px — visible as a hard edge
  // against the warm page wash. A mask gradient lets the text dissolve
  // into the actual background underneath, regardless of what's behind.
  const maskStyle: React.CSSProperties = showCollapsed
    ? {
        maskImage:
          "linear-gradient(to bottom, black 55%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, black 55%, transparent 100%)",
      }
    : {};

  return (
    <div className={`mt-7 font-body ${compact ? "text-[15px]" : "text-[17px] md:text-[18px]"} leading-[1.6]`}>
      <div
        className={`relative ${
          showCollapsed ? "max-h-[160px] md:max-h-[200px] overflow-hidden" : ""
        }`}
        style={maskStyle}
      >
        <div className="space-y-5">
          {description.split("\n\n").map((p, i) => (
            <p key={i}>{renderWithLinks(p)}</p>
          ))}
        </div>
      </div>
      {isLong && (
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggle}
          className="mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? "Show less ↑" : "Show more ↓"}
        </button>
      )}
    </div>
  );
}

