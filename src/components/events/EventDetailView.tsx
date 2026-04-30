import { ReactNode, useState } from "react";
import { MapPin, ExternalLink, ChevronDown, Plus, Users } from "lucide-react";
import { motion } from "framer-motion";
import ShareMenu from "@/components/events/ShareMenu";
import { formatDateWithDay, formatDateShort } from "@/lib/dateFormat";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { endsNextDay } from "@/lib/eventStatus";
import type { BarlinEvent } from "@/types/event";

function formatLanguage(raw: string | undefined | null): string | null {
  if (!raw) return null;
  return `in ${raw}`;
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
  >;

  // Future-only sibling dates of the same series, sorted ascending. Empty
  // array = no "Upcoming events in this bar" accordion.
  siblingDates: string[];

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

  // Pill click for sibling-date navigation. undefined → pills are inert.
  onSelectSibling?: (date: string) => void;

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
}

export default function EventDetailView({
  event,
  siblingDates,
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
}: EventDetailViewProps) {
  const displayTitle = cleanEventTitle(event.title || "(untitled)", event.venue);
  const hasRealImage = !!event.image;
  const interestDisabled = !onToggleInterest || isSaving;

  const heroHeight = compact ? "h-[120px]" : "h-[180px] md:h-[260px]";
  const titleSize = compact ? "text-lg" : "text-[22px] md:text-3xl";
  const interestButtonSize = compact ? "h-10 px-5 text-xs" : "h-12 px-6 text-sm";
  const whereOffset = compact ? "" : "md:pl-48";
  const detailsLine = [event.entryInfo, recurrenceLabel, formatLanguage(event.language)]
    .filter(Boolean)
    .join(" · ");

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
          {event.status === "canceled" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <span className="-rotate-12 border-2 border-red-600 text-red-600 bg-background/80 font-body text-sm md:text-base font-extrabold uppercase tracking-wider px-4 py-1.5 shadow-md whitespace-nowrap">
                Canceled by the organizer
              </span>
            </div>
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
        <div className="px-4 pb-4 pt-3 flex items-center gap-4">
          <div className="flex-1 flex items-center gap-3">
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
            {showInterestCount && (
              <span className="inline-flex items-center gap-1 text-sm text-accent font-mono">
                <Users className="h-4 w-4" />
                {interestedCount}
              </span>
            )}
          </div>
          {showShare && (
            <div className={`flex-1 ${whereOffset}`}>
              <ShareMenu eventTitle={displayTitle} eventId={event.id} variant="pill" />
            </div>
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
          <h2 className="font-body text-sm font-bold uppercase tracking-[0.12em]">About this event</h2>
          {detailsLine && <p className="text-sm text-muted-foreground">{detailsLine}</p>}
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
          {siblingDates.length > 1 && (
            <UpcomingDatesAccordion
              dates={siblingDates}
              activeDate={event.date}
              onSelectSibling={onSelectSibling}
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
  dates,
  activeDate,
  onSelectSibling,
}: {
  dates: string[];
  activeDate: string;
  onSelectSibling?: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border">
      <button
        className="w-full flex items-center justify-between py-3.5 text-sm text-foreground hover:text-accent transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="font-medium">Upcoming events in this bar</span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="flex flex-wrap gap-2 pb-3.5">
          {dates.map(d => {
            const isActive = d === activeDate;
            const clickable = !!onSelectSibling && !isActive;
            return (
              <button
                key={d}
                onClick={clickable ? () => onSelectSibling!(d) : undefined}
                className={`inline-flex items-center px-3 py-1.5 text-[11px] font-mono font-bold transition-all active:scale-95 ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : `border-2 border-border text-muted-foreground ${clickable ? "hover:border-foreground hover:text-foreground cursor-pointer" : "cursor-default"}`
                }`}
              >
                {formatDateShort(d)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

