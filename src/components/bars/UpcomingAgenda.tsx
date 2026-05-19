import { useMemo } from "react";
import type { BarlinEvent } from "@/types/event";
import EventCard from "@/components/events/EventCard";

interface UpcomingAgendaProps {
  events: BarlinEvent[];
  onEventClick: (id: string) => void;
}

export default function UpcomingAgenda({ events, onEventClick }: UpcomingAgendaProps) {
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
