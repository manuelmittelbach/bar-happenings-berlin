import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMyEvents, useProfile } from "@/hooks/useEvents";
import EventCard from "@/components/events/EventCard";
import Header from "@/components/layout/Header";
import type { BarlinEvent } from "@/data/mockData";

function formatDateHeader(dateStr: string) {
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  if (dateStr === today) return "Today";
  if (dateStr === tomorrow) return "Tomorrow";
  if (dateStr === yesterday) return "Yesterday";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
}

function formatPastDateHeader(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function groupByDate(events: BarlinEvent[]) {
  const groups: { date: string; events: BarlinEvent[] }[] = [];
  events.forEach((e) => {
    const last = groups[groups.length - 1];
    if (last && last.date === e.date) {
      last.events.push(e);
    } else {
      groups.push({ date: e.date, events: [e] });
    }
  });
  return groups;
}

export default function MyEvents() {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const { data: events = [], isLoading: eventsLoading } = useMyEvents(user?.id ?? null);
  const { data: profile } = useProfile(user?.id ?? null);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    if (role === "admin") navigate("/admin", { replace: true });
    else if (role === "organizer") navigate("/dashboard", { replace: true });
  }, [role, navigate]);

  const [justConfirmed] = useState(() => {
    if (sessionStorage.getItem("email-just-confirmed")) {
      sessionStorage.removeItem("email-just-confirmed");
      return true;
    }
    return false;
  });

  const isLateNight = new Date().getHours() < 6;
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const cutoff = isLateNight ? yesterday : today;

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  const yesterdayEvents = isLateNight ? sorted.filter(e => e.date === yesterday) : [];
  const upcomingEvents = sorted.filter(e => e.date >= today);
  const pastEvents = [...events]
    .filter(e => e.date < cutoff)
    .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="font-body text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="font-heading text-4xl font-extrabold uppercase tracking-tight">Welcome back.</h1>
          <p className="text-sm text-muted-foreground max-w-xs">Sign in to see your saved events.</p>
          <Link
            to="/login"
            className="h-11 px-6 flex items-center bg-foreground text-background font-body font-bold uppercase tracking-wider text-sm"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const hasAnyEvents = yesterdayEvents.length > 0 || upcomingEvents.length > 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <div className="max-w-screen-sm mx-auto px-4 pt-6">
        <div className="mb-8">
          {profile?.firstName && (
            <p className="mono-label text-muted-foreground">Hi, {profile.firstName}</p>
          )}
        </div>

        {eventsLoading ? (
          <p className="text-sm text-muted-foreground">Loading your events…</p>
        ) : !hasAnyEvents && pastEvents.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-4 text-center">
            <p className="font-body font-bold">{justConfirmed ? "Email confirmed!" : "Nothing saved yet"}</p>
            <p className="text-sm text-muted-foreground">Tap "Interested" on any event to save it here.</p>
            <Link to="/" className="h-11 px-6 flex items-center bg-accent text-white font-heading font-bold uppercase tracking-widest text-xs hover:bg-accent/90 transition-colors">
              Browse events
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {yesterdayEvents.length > 0 && (
              <div>
                <h2 className="font-heading text-xl font-extrabold uppercase tracking-tight mb-4 pb-2 border-b-2 border-foreground">
                  Yesterday
                </h2>
                <div className="grid grid-cols-1 gap-6">
                  {yesterdayEvents.map((event, i) => (
                    <EventCard key={event.id} event={event} index={i} featured={false} />
                  ))}
                </div>
              </div>
            )}

            {groupByDate(upcomingEvents).map((group) => (
              <div key={group.date}>
                <h2 className="font-heading text-xl font-extrabold uppercase tracking-tight mb-4 pb-2 border-b-2 border-foreground">
                  {formatDateHeader(group.date)}
                </h2>
                <div className="grid grid-cols-1 gap-6">
                  {group.events.map((event, i) => (
                    <EventCard key={event.id} event={event} index={i} featured={false} />
                  ))}
                </div>
              </div>
            ))}

            {pastEvents.length > 0 && (
              <div>
                <button
                  onClick={() => setShowPast(!showPast)}
                  className="flex items-center gap-2 font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPast ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  Past events ({pastEvents.length})
                </button>

                {showPast && (
                  <div className="mt-4 space-y-8">
                    {groupByDate(pastEvents).map((group) => (
                      <div key={group.date}>
                        <h2 className="font-heading text-base font-extrabold uppercase tracking-tight mb-4 pb-2 border-b border-border text-muted-foreground">
                          {formatPastDateHeader(group.date)}
                        </h2>
                        <div className="grid grid-cols-1 gap-6 opacity-60">
                          {group.events.map((event, i) => (
                            <EventCard key={event.id} event={event} index={i} featured={false} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
