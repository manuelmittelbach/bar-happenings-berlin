import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Bookmark, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMyEvents, useProfile } from "@/hooks/useEvents";
import EventCard from "@/components/events/EventCard";

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-4 text-center">
        <Bookmark className="h-8 w-8 text-muted-foreground" />
        <h1 className="font-body text-xl font-extrabold">Sign in to see your saved events</h1>
        <p className="text-sm text-muted-foreground">Create an account or log in to save events you're interested in.</p>
        <Link
          to="/login"
          className="h-11 px-6 flex items-center bg-accent text-accent-foreground font-body font-bold uppercase tracking-wider text-sm rounded-full"
        >
          Sign in
        </Link>
        <button onClick={() => navigate(-1)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Sticky back bar */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border flex items-center px-4 py-3 gap-2">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm font-medium tracking-wide transition-colors focus:outline-none"
        >
          <ArrowLeft className="h-4 w-4" />
          Events
        </button>
      </div>

      <div className="max-w-screen-md mx-auto px-4 pt-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            {profile?.firstName && (
              <p className="text-sm text-muted-foreground mb-1">
                Hi, {profile.firstName}
              </p>
            )}
            <h1 className="font-body text-2xl font-extrabold tracking-tight">
              Your saved events
            </h1>
          </div>
          <button
            onClick={async () => { await signOut(); navigate("/"); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>

        {eventsLoading ? (
          <p className="text-sm text-muted-foreground">Loading your events…</p>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-4 text-center">
            <Bookmark className="h-8 w-8 text-muted-foreground" />
            <p className="font-body font-bold">Nothing saved yet</p>
            <p className="text-sm text-muted-foreground">Tap "Interested" on any event to save it here.</p>
            <Link
              to="/"
              className="text-sm text-accent font-medium hover:underline"
            >
              Browse events
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <EventCard key={event.id} event={event} layout="list" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
