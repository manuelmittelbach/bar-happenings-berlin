import { CalendarPlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  googleCalendarUrl,
  buildIcs,
  icsFilename,
  type CalendarEventInput,
} from "@/lib/calendarLinks";

type CalendarMenuProps = CalendarEventInput;

/**
 * "Add to Calendar" — a popover with two targets that mirror the Share menu:
 * Google Calendar (a prefilled create-event link) and Apple Calendar (a .ics
 * download that iOS/macOS/Thunderbird pick up). Web/PWA only — the native app
 * is not live yet, so no Capacitor file handoff here.
 */
export default function CalendarMenu(props: CalendarMenuProps) {
  const handleAppleDownload = () => {
    try {
      const blob = new Blob([buildIcs(props)], {
        type: "text/calendar;charset=utf-8",
      });
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = icsFilename(props.title);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke on the next tick so the download has a chance to start.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      toast.error("Could not create calendar file");
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center justify-center h-8 w-8 rounded-full md:rounded-none border-2 border-foreground text-foreground hover:bg-foreground hover:text-background active:scale-95 active:opacity-80 transition-all"
          aria-label="Add to calendar"
        >
          <CalendarPlus className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 border-2 border-foreground" align="end">
        <a
          href={googleCalendarUrl(props)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-2 py-2 text-sm hover:bg-muted transition-colors w-full"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
            <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14v11zM5 7V6h14v1H5zm7.5 4H11v5h1.5v-5z" />
          </svg>
          <span>Google Calendar</span>
        </a>
        <div className="my-1 border-t border-border" />
        <button
          onClick={handleAppleDownload}
          className="flex items-center gap-3 px-2 py-2 text-sm hover:bg-muted transition-colors w-full"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
            <path d="M16.365 1.43c0 1.14-.417 2.22-1.11 3.02-.79.9-2.07 1.6-3.13 1.52-.14-1.1.42-2.27 1.06-2.99.72-.82 2.02-1.44 3.05-1.5.02.32.02.63.13.95zM20.5 17.1c-.6 1.38-.9 2-1.66 3.2-1.07 1.68-2.58 3.77-4.45 3.79-1.66.02-2.09-1.08-4.34-1.07-2.25.01-2.72 1.09-4.38 1.07-1.87-.02-3.3-1.9-4.37-3.58C-1.13 17.16-1.35 11.06 1.46 7.8 2.85 6.2 4.9 5.2 6.83 5.2c1.98 0 3.22 1.08 4.86 1.08 1.59 0 2.56-1.08 4.85-1.08 1.72 0 3.55.94 4.85 2.56-4.26 2.34-3.57 8.42.11 9.34z" />
          </svg>
          <span>Apple Calendar</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
