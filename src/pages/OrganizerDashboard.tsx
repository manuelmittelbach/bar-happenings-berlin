import { useState, useEffect } from "react";
import { formatDateWithDay } from "@/lib/dateFormat";
import { Link, useNavigate } from "react-router-dom";
import { Eye, Pencil, Plus, Users, CalendarDays, Clock, Clock3, XCircle, CheckCircle2 } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { fetchEventsByCreator } from "@/lib/supabaseQueries";
import type { BarlinEvent } from "@/data/mockData";

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-green-500/10 text-green-600",
  pending: "bg-yellow-500/10 text-yellow-600",
  rejected: "bg-red-500/10 text-red-600",
};

export default function OrganizerDashboard() {
  const { user, role, approvalStatus, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [myEvents, setMyEvents] = useState<BarlinEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const isApprovedAccess = role === "admin" || (role === "organizer" && approvalStatus === "approved");

  const [justConfirmed] = useState(() => {
    if (sessionStorage.getItem("email-just-confirmed")) {
      sessionStorage.removeItem("email-just-confirmed");
      return true;
    }
    return false;
  });

  useEffect(() => {
    if (!loading && role !== null && role !== "organizer" && role !== "admin") {
      navigate("/", { replace: true });
    }
  }, [user, role, loading, navigate]);

  useEffect(() => {
    if (!user || !isApprovedAccess) return;
    fetchEventsByCreator(user.id)
      .then(setMyEvents)
      .catch(() => toast.error("Failed to load your events."))
      .finally(() => setEventsLoading(false));
  }, [user, isApprovedAccess]);

  const isLateNight = new Date().getHours() < 6;
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const cutoff = isLateNight ? yesterday : today;
  const upcoming = myEvents.filter(e => e.date >= cutoff).sort((a, b) => a.date.localeCompare(b.date));
  const past = myEvents.filter(e => e.date < cutoff);
  const displayed = activeTab === "upcoming" ? upcoming : past;

  if (loading || role === null) return null;
  if (!user) return null;

  if (role === "organizer" && approvalStatus !== "approved") {
    const rejected = approvalStatus === "rejected";
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center py-16">
          <div className="w-full max-w-md mx-auto px-4 text-center space-y-5">
            {justConfirmed && (
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-sm bg-green-500/10 text-green-600 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" /> Email confirmed!
              </div>
            )}
            <div className="flex justify-center">
              {rejected ? (
                <XCircle className="h-10 w-10 text-accent" />
              ) : (
                <Clock3 className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
            <h1 className="heading-display text-2xl">
              {rejected ? "Application not approved" : "Awaiting admin approval"}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {rejected
                ? "Your bar account application was not approved. If you think this is a mistake, please contact us."
                : "Thanks for signing up! An admin needs to review your bar details before you can publish events. You'll get access automatically as soon as your account is approved."}
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container py-8">
          {justConfirmed && (
            <div className="mb-6 inline-flex items-center gap-2 px-3 py-2 rounded-sm bg-green-500/10 text-green-600 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" /> Email confirmed!
            </div>
          )}
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            {[
              { label: "Total Events", value: String(myEvents.length), icon: CalendarDays },
              { label: "Upcoming", value: String(upcoming.length), icon: Clock },
              { label: "Total Interested", value: String(myEvents.reduce((s, e) => s + (e.interestedCount ?? 0), 0)), icon: Users },
            ].map((stat) => (
              <div key={stat.label} className="border border-border rounded-sm p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground font-medium">{stat.label}</span>
                  <stat.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="font-heading text-3xl font-bold">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-end mb-8">
            <Link
              to="/publish"
              className="inline-flex items-center gap-2 h-11 px-5 bg-foreground text-background rounded-sm text-sm font-semibold hover:bg-foreground/90 transition-colors"
            >
              <Plus className="h-4 w-4" /> New Event
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 border-b border-border mb-6">
            {(["upcoming", "past"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-base font-medium capitalize transition-colors border-b-2 -mb-px ${
                  activeTab === tab ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Events list */}
          {eventsLoading && <p className="text-base text-muted-foreground">Loading…</p>}
          {!eventsLoading && displayed.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-base">No {activeTab} events yet.</p>
              {activeTab === "upcoming" && (
                <Link to="/publish" className="inline-block mt-3 text-sm text-accent hover:underline">
                  Create an event →
                </Link>
              )}
            </div>
          )}
          {!eventsLoading && displayed.length > 0 && (
            <div className="space-y-3">
              {displayed.map((event) => (
                <div
                  key={event.id}
                  className="border border-border rounded-sm p-5 flex flex-col sm:flex-row gap-4"
                >
                  {event.image && (
                    <div className="w-full sm:w-28 h-24 rounded-sm overflow-hidden flex-shrink-0 bg-muted">
                      <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading text-base font-semibold">{event.title}</span>
                      <span className={`text-sm px-2 py-0.5 rounded-sm font-medium capitalize ${STATUS_STYLE[event.status ?? "pending"] ?? ""}`}>
                        {event.status === "approved" ? "online" : (event.status ?? "pending")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDateWithDay(event.date)} · {event.startTime}{event.endTime ? ` – ${event.endTime}` : ""} · {event.neighborhood}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {event.interestedCount ?? 0} interested</span>
                    </div>
                  </div>
                  <div className="flex sm:flex-col gap-3 sm:items-end justify-end flex-shrink-0">
                    <Link
                      to={`/event/${event.id}`}
                      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Eye className="h-4 w-4" /> View
                    </Link>
                    <Link
                      to={`/edit-event/${event.id}`}
                      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-4 w-4" /> Edit
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
