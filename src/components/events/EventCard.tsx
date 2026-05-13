import { useMemo } from "react";
import { Link } from "react-router-dom";
import { cleanEventTitle } from "@/lib/cleanTitle";
import EventMeta from "@/components/events/EventMeta";
import type { BarlinEvent } from "@/types/event";
import { useCategories } from "@/hooks/useEvents";

interface EventCardProps {
  event: BarlinEvent;
  // "list" matches the Inside Bars design — flat hairline-separated row used
  // in All Tonight / Later. "grid" renders the magazine highlight card.
  // "free" renders the wide card with the FREE/DONATION pill on the right.
  layout?: "grid" | "list" | "free";
  index?: number;
  onClick?: (eventId: string) => void;
}

/* EventCard — design-faithful card variants for the homepage.
 *
 * No temporal "Soon / Over / Might be over" chips. No walking-distance chip.
 * The only dynamic state on a card is the pulsing orange Now indicator
 * (rendered inside EventMeta) and a 55% opacity treatment for canceled
 * events with a small red Canceled pill in the meta row. */
export default function EventCard({ event, layout = "list", onClick }: EventCardProps) {
  const displayTitle = useMemo(
    () => cleanEventTitle(event.title, event.venue),
    [event.title, event.venue],
  );
  const { data: categories = [] } = useCategories();
  const isCanceled = event.status === "canceled";

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick(event.id);
    }
  };

  const venueLine = (
    <div className="font-body text-[13px] text-muted-foreground mt-1 flex gap-1.5 items-center flex-wrap">
      <span>{event.venue}</span>
      {event.neighborhood && (
        <>
          <span className="opacity-50">·</span>
          <span>{event.neighborhood}</span>
        </>
      )}
    </div>
  );

  /* ─── LIST layout — All Tonight, All Tomorrow, Later ─── */
  if (layout === "list") {
    return (
      <Link
        to={`/event/${event.id}`}
        onClick={handleClick}
        className={`group relative flex flex-col gap-1.5 py-4 border-b-2 border-border no-underline text-foreground ${
          isCanceled ? "opacity-55" : ""
        }`}
      >
        <EventMeta event={event} categories={categories} />
        <h3
          className={`font-body text-[22px] font-bold leading-[1.2] m-0 transition-colors group-hover:text-accent ${
            isCanceled ? "line-through" : ""
          }`}
        >
          {displayTitle}
        </h3>
        {venueLine}
        {event.description && (
          <p className="font-body text-[13px] leading-[1.5] text-muted-foreground mt-1.5 line-clamp-1">
            {event.description}
          </p>
        )}
      </Link>
    );
  }

  /* ─── FREE layout — wide card with FREE/DONATION pill on the right ─── */
  if (layout === "free") {
    return (
      <Link
        to={`/event/${event.id}`}
        onClick={handleClick}
        className={`relative grid grid-cols-[1fr_auto] items-center gap-4 md:gap-5 px-4 md:px-5 py-4 md:py-[18px] bg-background border-2 border-foreground rounded-2xl hover:border-accent transition-colors no-underline text-foreground ${
          isCanceled ? "opacity-50" : ""
        }`}
      >
        <div className="min-w-0">
          <EventMeta event={event} categories={categories} size="md" />
          <h3
            className={`font-body text-[24px] font-bold leading-[1.2] mt-2 mb-0 ${
              isCanceled ? "line-through" : ""
            }`}
          >
            {displayTitle}
          </h3>
          {venueLine}
        </div>
      </Link>
    );
  }

  /* ─── GRID layout — magazine highlight card (used by TonightsHighlights) ─── */
  return (
    <Link
      to={`/event/${event.id}`}
      onClick={handleClick}
      className={`relative block bg-background border-2 border-foreground rounded-2xl hover:border-accent transition-all overflow-hidden card-hl no-underline text-foreground ${
        isCanceled ? "opacity-55" : ""
      }`}
      style={{ padding: "20px 18px 18px" }}
    >
      <span className="absolute top-0 left-0 right-0 h-1.5 bg-accent" />
      <EventMeta event={event} categories={categories} />
      <h3
        className={`font-body text-[20px] font-bold leading-[1.22] mt-2.5 mb-0 ${
          isCanceled ? "line-through" : ""
        }`}
      >
        {displayTitle}
      </h3>
      {venueLine}
    </Link>
  );
}
