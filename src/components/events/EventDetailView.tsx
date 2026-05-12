import React, { ReactNode, Fragment, useState } from "react";
import { MapPin, ExternalLink, Pencil, Euro, Repeat, Languages, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import ShareMenu from "@/components/events/ShareMenu";
import { formatDateWithDay, formatDateShort } from "@/lib/dateFormat";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { endsNextDay } from "@/lib/eventStatus";
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

export interface UpcomingEvent {
  id: string;
  date: string;
  startTime?: string;
  status?: string;
}

export interface EventDetailViewProps {
  // Core event payload. The admin preview synthesizes this from a staged row.
  event: Pick<
    BarlinEvent,
    | "id"
    | "title"
    | "venue"
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

  // Future-only events at the same venue, sorted by date+startTime. The
  // current event is included; it's marked active in the pill grid.
  // Length <= 1 hides the venue-block "All events at this bar" button.
  upcomingEvents: UpcomingEvent[];

  // Pre-computed recurrence label (e.g. "Every Tuesday"). null = hide.
  recurrenceLabel: string | null;

  // Pill click for sibling navigation. Receives the target event id. When
  // undefined, pills render inert (used by admin preview).
  onSelectSibling?: (eventId: string) => void;

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

  // Controlled state for the "All events at this bar" pill grid. When
  // provided, lets the parent persist open/closed across sibling
  // navigations (so the panel doesn't snap shut while a new event loads).
  upcomingOpen?: boolean;
  onToggleUpcoming?: () => void;

  // Admin-only edit shortcut. When provided, renders a pencil button in
  // the hero (or eyebrow row when there's no hero image).
  onEdit?: () => void;
}

export default function EventDetailView({
  event,
  upcomingEvents,
  recurrenceLabel,
  onSelectSibling,
  onOpenMaps,
  showShare,
  compact = false,
  headerBanner,
  upcomingOpen,
  onToggleUpcoming,
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
  const priceText = event.entryInfo?.replace(/€/g, "");
  const detailItems: { icon: LucideIcon; text: string }[] = [
    priceText ? { icon: Euro, text: priceText } : null,
    recurrenceLabel ? { icon: Repeat, text: recurrenceLabel } : null,
    event.language ? { icon: Languages, text: event.language } : null,
  ].filter((x): x is { icon: LucideIcon; text: string } => x !== null);

  const eyebrowTime = event.startTime
    ? `${event.startTime}${event.endTime ? `–${event.endTime}` : ""}`
    : null;
  const eyebrowDate = event.date ? formatDateWithDay(event.date) : null;
  const eyebrowParts = [categoryLabel, eyebrowDate, eyebrowTime].filter(Boolean) as string[];
  const eyebrowColor = categoryColor || "hsl(var(--accent))";

  // Internally-controlled fallback when the parent doesn't pass controlled props.
  const [localUpcomingOpen, setLocalUpcomingOpen] = useState(false);
  const upcomingIsControlled = upcomingOpen !== undefined;
  const upcomingIsOpen = upcomingIsControlled ? upcomingOpen : localUpcomingOpen;
  const toggleUpcoming = upcomingIsControlled
    ? (onToggleUpcoming ?? (() => {}))
    : () => setLocalUpcomingOpen((o) => !o);

  const hasUpcomingSiblings = upcomingEvents.length > 1;

  const titleStyle: React.CSSProperties = {
    fontSize: compact ? "clamp(22px, 5vw, 30px)" : "clamp(34px, 6vw, 60px)",
  };

  const articlePadding = compact ? "p-4" : "px-6 pt-8 pb-16 md:px-8";
  const articleWidth = compact ? "max-w-full" : "max-w-[880px] mx-auto";

  return (
    <div className="bg-background text-foreground">
      {headerBanner}

      <article className={`${articleWidth} ${articlePadding}`}>
        {/* A. Lede figure — magazine top photo when an image is available. */}
        {hasRealImage && (
          <figure className={`relative border-2 border-foreground overflow-hidden mb-6 aspect-[3/2] ${compact ? "" : "md:aspect-[16/9]"}`}>
            <img
              src={event.image!}
              alt={displayTitle}
              style={{ objectPosition: event.imagePosition }}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {categoryLabel && (
              <div
                className="absolute top-3 left-3 z-10 inline-flex items-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent-foreground px-3 py-1 shadow-md"
                style={{ backgroundColor: eyebrowColor }}
              >
                {categoryLabel}
              </div>
            )}
            {isCanceled && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <span className="inline-block font-heading font-bold text-xs md:text-sm uppercase tracking-[0.06em] text-destructive border-2 border-destructive px-3 py-1 bg-background/85 -rotate-3 whitespace-nowrap">
                  {canceledLabel}
                </span>
              </div>
            )}
            {onEdit && (
              <button
                onClick={onEdit}
                aria-label="Edit event"
                className="absolute top-3 right-3 z-10 h-9 w-9 flex items-center justify-center bg-background/85 border-2 border-foreground text-foreground hover:bg-accent hover:text-accent-foreground hover:border-accent transition-colors active:scale-95"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </figure>
        )}

        {/* B. Eyebrow row — category color · date · time, with overlays
            relocated here when the lede figure is absent. */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex-1 min-w-0 font-mono text-[11px] font-bold uppercase tracking-[0.14em] flex items-center gap-2 flex-wrap"
            style={{ color: eyebrowColor }}
          >
            {!hasRealImage && categoryLabel && (
              <span
                aria-hidden="true"
                className="inline-block w-2 h-2 shrink-0"
                style={{ backgroundColor: eyebrowColor }}
              />
            )}
            {eyebrowParts.map((part, i) => (
              <Fragment key={i}>
                {i > 0 && <span className="opacity-60">·</span>}
                <span>{part}</span>
              </Fragment>
            ))}
          </div>
          {!hasRealImage && isCanceled && (
            <span className="shrink-0 inline-block font-heading font-bold text-xs uppercase tracking-[0.06em] text-destructive border-2 border-destructive px-2.5 py-0.5 -rotate-3 whitespace-nowrap">
              {canceledLabel}
            </span>
          )}
          {!hasRealImage && onEdit && (
            <button
              onClick={onEdit}
              aria-label="Edit event"
              className="shrink-0 h-9 w-9 flex items-center justify-center border-2 border-foreground text-foreground hover:bg-accent hover:text-accent-foreground hover:border-accent transition-colors active:scale-95"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* C. Display title — Syne 800, fluid magazine-masthead size. */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="font-heading font-extrabold tracking-[-0.02em] leading-[0.95] mb-6"
          style={titleStyle}
        >
          {displayTitle}
        </motion.h1>

        {/* D. Action row — Share primary CTA on the left, metadata chips on
            the right, 2px foreground bottom-rule. */}
        {(showShare || detailItems.length > 0) && (
          <div className="flex items-center gap-3 flex-wrap pb-6 border-b-2 border-foreground">
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

        {/* Doors / next-day microcopy lives just under the action row. */}
        {(event.doorsTime || (event.startTime && endsNextDay(event.startTime, event.endTime))) && (
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {event.doorsTime && <>Doors {event.doorsTime}</>}
            {event.doorsTime && event.startTime && endsNextDay(event.startTime, event.endTime) && " · "}
            {event.startTime && endsNextDay(event.startTime, event.endTime) && <>Ends next day</>}
          </p>
        )}

        {/* E. Description — DM Sans 17/18px, generous leading. */}
        <div className={`mt-7 font-body ${compact ? "text-[15px]" : "text-[17px] md:text-[18px]"} leading-[1.6] space-y-5`}>
          {event.description ? (
            event.description.split("\n\n").map((p, i) => (
              <p key={i}>{renderWithLinks(p)}</p>
            ))
          ) : (
            <p className="italic text-muted-foreground/70 text-sm">(no description)</p>
          )}
        </div>

        {/* F. Venue block — bordered editorial card with "Open in Maps" +
            "All events at this bar" controls. */}
        <div className="mt-10 border-2 border-foreground p-5">
          <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-1.5">
            The venue
          </div>
          <h3 className={`font-heading font-extrabold uppercase tracking-[-0.01em] ${compact ? "text-[20px]" : "text-[22px] md:text-[26px]"}`}>
            {event.venue}
          </h3>
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
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <button
              onClick={onOpenMaps}
              className="inline-flex items-center gap-2 h-[38px] px-4 border-2 border-foreground bg-transparent text-foreground font-mono text-[11px] font-bold uppercase tracking-[0.1em] hover:bg-foreground hover:text-background transition-colors active:scale-[0.98]"
            >
              Open in Google Maps <span aria-hidden="true">›</span>
            </button>
            {hasUpcomingSiblings && (
              <button
                onClick={toggleUpcoming}
                aria-expanded={upcomingIsOpen}
                className={`inline-flex items-center gap-2 h-[38px] px-4 border-2 border-foreground font-mono text-[11px] font-bold uppercase tracking-[0.1em] transition-colors active:scale-[0.98] ${
                  upcomingIsOpen
                    ? "bg-foreground text-background"
                    : "bg-transparent text-foreground hover:bg-foreground hover:text-background"
                }`}
              >
                {upcomingIsOpen ? "Hide all events" : "All events at this bar"}
              </button>
            )}
          </div>
        </div>

        {/* G. Upcoming pill grid — revealed by the venue-block toggle. */}
        {hasUpcomingSiblings && upcomingIsOpen && (
          <UpcomingPills
            events={upcomingEvents}
            activeId={event.id}
            onSelectSibling={onSelectSibling}
          />
        )}

        {/* H. Event link — full-width btn-outline footer link. */}
        {event.url && (
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 w-full inline-flex items-center justify-between h-12 px-5 border-2 border-foreground text-foreground font-mono text-[11px] font-bold uppercase tracking-[0.12em] hover:bg-foreground hover:text-background transition-colors"
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

function UpcomingPills({
  events,
  activeId,
  onSelectSibling,
}: {
  events: UpcomingEvent[];
  activeId: string;
  onSelectSibling?: (eventId: string) => void;
}) {
  // Only show start time on a pill when the same date has multiple events —
  // otherwise the date alone is unambiguous and reads cleaner.
  const dateCounts: Record<string, number> = {};
  events.forEach((e) => {
    dateCounts[e.date] = (dateCounts[e.date] ?? 0) + 1;
  });

  return (
    <div className="border-2 border-foreground border-t-0 px-5 py-4">
      <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-3">
        Upcoming dates
      </div>
      <div className="flex flex-wrap gap-2">
        {events.map((e) => {
          const isActive = e.id === activeId;
          const clickable = !!onSelectSibling && !isActive;
          const showTime = (dateCounts[e.date] ?? 0) > 1 && !!e.startTime;
          const label = showTime
            ? `${formatDateShort(e.date)} · ${e.startTime}`
            : formatDateShort(e.date);
          return (
            <button
              key={e.id}
              onClick={clickable ? () => onSelectSibling!(e.id) : undefined}
              className={`inline-flex items-center px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] border-2 transition-all active:scale-95 ${
                isActive
                  ? "bg-accent text-accent-foreground border-accent"
                  : `border-foreground text-foreground ${clickable ? "hover:bg-foreground hover:text-background cursor-pointer" : "cursor-default opacity-60"}`
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
