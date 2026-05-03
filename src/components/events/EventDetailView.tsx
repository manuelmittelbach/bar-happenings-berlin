import { ReactNode, Fragment, useState } from "react";
import { MapPin, ExternalLink, ChevronDown, Plus, Users, Pencil, Euro, Repeat, Languages, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import ShareMenu from "@/components/events/ShareMenu";
import { formatDateWithDay, formatDateShort } from "@/lib/dateFormat";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { endsNextDay } from "@/lib/eventStatus";
import type { BarlinEvent } from "@/types/event";


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
  // current event is included; the accordion marks it as the active pill.
  // Length <= 1 hides the accordion.
  upcomingEvents: UpcomingEvent[];

  // Pre-computed recurrence label (e.g. "Every Tuesday"). null = hide.
  recurrenceLabel: string | null;

  // Interested-count shown next to the button when showInterestCount is true.
  interestedCount: number;
  showInterestCount: boolean;

  // Interest button state. onToggleInterest = undefined → button disabled
  // (used by admin preview where interest can't be toggled).
  saved: boolean;
  isSaving: boolean;
  onToggleInterest?: () => void;

  // Pill click for sibling navigation. Receives the target event id. When
  // undefined, pills render inert (used by admin preview).
  onSelectSibling?: (eventId: string) => void;

  // "Open in Maps" handler.
  onOpenMaps: () => void;

  // ShareMenu visibility (admin preview hides it).
  showShare: boolean;

  // Compact = smaller hero, smaller title, no md:-upscales. Used by the
  // admin preview which renders inside a narrow column on wide viewports
  // (where md: breakpoints would otherwise trigger).
  compact?: boolean;

  // Optional banner rendered above the hero (admin preview uses this for
  // the "Live preview" strip).
  headerBanner?: ReactNode;

  // Controlled state for the "Upcoming events in this bar" accordion.
  // When provided, lets the parent persist open/closed across sibling
  // navigations (so the panel doesn't snap shut while a new event loads).
  upcomingOpen?: boolean;
  onToggleUpcoming?: () => void;

  // Admin-only edit shortcut. When provided, renders a pencil button in
  // the hero that jumps to the edit page.
  onEdit?: () => void;
}

export default function EventDetailView({
  event,
  upcomingEvents,
  recurrenceLabel,
  interestedCount,
  showInterestCount,
  saved,
  isSaving,
  onToggleInterest,
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
  const interestDisabled = !onToggleInterest || isSaving;

  const heroHeight = compact ? "h-[120px]" : "h-[180px] md:h-[260px]";
  const titleSize = compact ? "text-lg" : "text-[22px] md:text-3xl";
  const interestButtonSize = compact ? "h-10 px-5 text-xs" : "h-12 px-6 text-sm";
  const whereOffset = compact ? "" : "md:pl-48";
  // Strip € from price text since the Euro icon already conveys it. Spaces
  // are preserved as written.
  const priceText = event.entryInfo?.replace(/€/g, "");
  const detailItems: { icon: LucideIcon; text: string }[] = [
    priceText ? { icon: Euro, text: priceText } : null,
    recurrenceLabel ? { icon: Repeat, text: recurrenceLabel } : null,
    event.language ? { icon: Languages, text: event.language } : null,
  ].filter((x): x is { icon: LucideIcon; text: string } => x !== null);

  return (
    <div className="bg-background">
      {headerBanner}

      <div className={compact ? "" : "max-w-screen-md mx-auto"}>
        {/* Hero image */}
        <div className={`relative ${heroHeight} bg-muted overflow-hidden`}>
          {hasRealImage && (
            <img
              src={event.image!}
              alt={displayTitle}
              style={{ objectPosition: event.imagePosition }}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          {event.category && (
            <div className="absolute top-3 left-3 z-20 inline-flex items-center bg-accent text-accent-foreground px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider shadow-md">
              {event.category}
            </div>
          )}
          {event.status === "canceled" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <span className="-rotate-12 border-2 border-red-600 text-red-600 bg-background/80 font-body text-sm md:text-base font-extrabold uppercase tracking-wider px-4 py-1.5 shadow-md whitespace-nowrap">
                {event.canceledBy === "admin" ? "Canceled" : "Canceled by the organizer"}
              </span>
            </div>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              aria-label="Edit event"
              className="absolute top-3 right-3 z-20 h-9 w-9 flex items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border border-border text-foreground hover:bg-accent hover:text-accent-foreground hover:border-accent transition-colors active:scale-95"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Title */}
        <div className="px-4 pt-4 pb-1">
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`font-body ${titleSize} font-extrabold leading-[1.1] tracking-tight`}
          >
            {displayTitle}
          </motion.h1>
        </div>

        {/* Interested + Share */}
        <div className="px-4 pb-4 pt-3 flex items-center gap-3">
          <button
            onClick={onToggleInterest}
            disabled={interestDisabled}
            className={`${interestButtonSize} flex items-center gap-2 font-bold uppercase tracking-wider font-body rounded-full border-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-70 ${
              saved
                ? "bg-accent text-accent-foreground border-accent"
                : "bg-transparent text-foreground border-accent hover:bg-accent/10"
            } ${!onToggleInterest ? "cursor-default" : ""}`}
          >
            {!saved && <Plus className="h-4 w-4" />}
            Interested
          </button>
          {showShare && (
            <ShareMenu eventTitle={displayTitle} eventId={event.id} variant="icon-circle" />
          )}
          {showInterestCount && (
            <span className="inline-flex items-center gap-1 text-sm text-accent font-mono">
              <Users className="h-4 w-4" />
              {interestedCount}
            </span>
          )}
        </div>

        <div className="border-t border-border mx-4" />

        {/* When + Where */}
        <div className="px-4 pt-3 pb-3 flex items-start gap-4">
          <div className="flex-1">
            {event.date ? (
              <p className="font-body font-bold text-sm">{formatDateWithDay(event.date)}</p>
            ) : (
              <p className="font-body font-bold text-sm text-muted-foreground italic">(no date)</p>
            )}
            {event.startTime ? (
              <p className="text-foreground font-mono text-sm mt-0.5">
                {event.startTime}
                {event.endTime ? ` – ${event.endTime}` : ""}
                {event.doorsTime ? `, Doors: ${event.doorsTime}` : ""}
                {endsNextDay(event.startTime, event.endTime) && (
                  <span className="text-muted-foreground text-xs ml-1">(next day)</span>
                )}
              </p>
            ) : (
              <p className="text-muted-foreground font-mono text-xs mt-0.5 italic">
                No info on start time
              </p>
            )}
          </div>

          <div className={`flex-1 text-left ${whereOffset}`}>
            <p className="font-body font-bold text-sm">{event.venue}</p>
            {event.address && (
              <p className="text-muted-foreground text-[13px] mt-0.5">
                {event.address.replace(/,\s*(Germany|Deutschland)\s*$/i, "")}
              </p>
            )}
            <p className="text-muted-foreground text-[13px] mt-0.5 flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" /> {event.neighborhood}
            </p>
            <div className="mt-1 flex items-center gap-2 text-xs font-mono text-accent">
              <button onClick={onOpenMaps} className="cursor-pointer hover:underline">
                Open in Maps
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-border mx-4" />

        {/* About this event */}
        <div className="px-4 py-5 space-y-4">
          {detailItems.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
              {detailItems.map((item, i) => (
                <Fragment key={i}>
                  {i > 0 && <span className="text-muted-foreground/60">·</span>}
                  <span className="inline-flex items-center gap-1.5">
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.text}</span>
                  </span>
                </Fragment>
              ))}
            </div>
          )}
          <h2 className="font-body text-sm font-bold uppercase tracking-[0.12em]">About this event</h2>
          {event.description ? (
            event.description.split("\n\n").map((p, i) => (
              <p key={i} className="text-sm text-muted-foreground/80 leading-[1.75] font-body">{p}</p>
            ))
          ) : (
            <p className="text-xs italic text-muted-foreground/70">(no description)</p>
          )}
        </div>

        <div className="border-t border-border mx-4" />

        {/* Utility rows */}
        <div className="px-4">
          {upcomingEvents.length > 1 && (
            <UpcomingDatesAccordion
              events={upcomingEvents}
              activeId={event.id}
              onSelectSibling={onSelectSibling}
              open={upcomingOpen}
              onToggleOpen={onToggleUpcoming}
            />
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

function UpcomingDatesAccordion({
  events,
  activeId,
  onSelectSibling,
  open: controlledOpen,
  onToggleOpen,
}: {
  events: UpcomingEvent[];
  activeId: string;
  onSelectSibling?: (eventId: string) => void;
  open?: boolean;
  onToggleOpen?: () => void;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : localOpen;
  const toggle = isControlled
    ? (onToggleOpen ?? (() => {}))
    : () => setLocalOpen(o => !o);

  // Only show the start time on a pill when the same date has multiple
  // events — otherwise the date alone is unambiguous and reads cleaner.
  const dateCounts: Record<string, number> = {};
  events.forEach(e => { dateCounts[e.date] = (dateCounts[e.date] ?? 0) + 1; });

  return (
    <div className="border-b border-border">
      <button
        className="w-full flex items-center justify-between py-3.5 text-sm text-foreground hover:text-accent transition-colors"
        onClick={toggle}
      >
        <span className="font-medium">Upcoming events in this bar</span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="flex flex-wrap gap-2 pb-3.5">
          {events.map(e => {
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
                className={`inline-flex items-center px-3 py-1.5 text-[11px] font-mono font-bold transition-all active:scale-95 ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : `border-2 border-border text-muted-foreground ${clickable ? "hover:border-foreground hover:text-foreground cursor-pointer" : "cursor-default"}`
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

