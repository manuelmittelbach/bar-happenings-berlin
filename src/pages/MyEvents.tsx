import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Bookmark, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMyEvents, useProfile } from "@/hooks/useEvents";
import EventCard from "@/components/events/EventCard";
import type { BarlinEvent } from "@/data/mockData";

function formatDateHeader(dateStr: string) {
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  if (dateStr === today) return "Today";
  if (dateStr === tomorrow) return "Tomorrow";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
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
  const { user, loading, signOut } = useAuth();
  const { data: events = [], isLoading: eventsLoading } = useMyEvents(user?.id ?? null);
  const { data: profile } = useProfile(user?.id ?? null);

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
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-base font-medium tracking-wide transition-colors focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 text-center">
          <Bookmark className="h-8 w-8 text-muted-foreground" />
          <h1 className="font-body text-xl font-extrabold">Sign in to see your saved events</h1>
          <p className="text-sm text-muted-foreground">Create an account or log in to save events you're interested in.</p>
          <Link
            to="/login"
            state={{ from: "/my-events" }}
            className="h-11 px-6 flex items-center bg-foreground text-background font-body font-bold uppercase tracking-wider text-sm"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border flex items-center justify-between px-4 py-3">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-base font-medium tracking-wide transition-colors focus:outline-none"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
        <button
          onClick={async () => { await signOut(); navigate("/"); }}
          className="flex items-center gap-1.5 text-base text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Sign out
        </button>
      </div>

      <div className="max-w-screen-sm mx-auto px-4 pt-6">
        <div className="mb-6">
          {profile?.firstName && (
            <p className="text-lg text-muted-foreground mb-1">Hi, {profile.firstName}</p>
          )}
          <h1 className="font-body text-2xl font-extrabold tracking-tight">Your saved events</h1>
        </div>

        {eventsLoading ? (
          <p className="text-sm text-muted-foreground">Loading your events…</p>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-4 text-center">
            <Bookmark className="h-8 w-8 text-muted-foreground" />
            <p className="font-body font-bold">Nothing saved yet</p>
            <p className="text-sm text-muted-foreground">Tap "Interested" on any event to save it here.</p>
            <Link to="/" className="text-sm text-foreground font-medium hover:text-muted-foreground transition-colors">
              Browse events
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {groupByDate([...events].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))).map((group) => (
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
          </div>
        )}
      </div>
    </div>
  );
}
