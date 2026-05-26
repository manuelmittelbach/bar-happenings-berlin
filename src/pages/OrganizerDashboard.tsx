import { useState, useEffect, useMemo } from "react";
import { formatDateWithDay } from "@/lib/dateFormat";
import { Link, useNavigate } from "react-router-dom";
import { Eye, Pencil, Plus, Users, CalendarDays, Clock, Clock3, XCircle, CheckCircle2, Repeat, ChevronDown, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { fetchEventsByCreator, fetchOrganizerById } from "@/lib/supabaseQueries";
import { isEventInPast, isEventStillOnline, hasEventStarted } from "@/lib/eventStatus";
import { formatRecurrenceLabel } from "@/lib/recurrence";
import { Spinner } from "@/components/ui/spinner";
import { consumeJustConfirmed, clearJustConfirmedSoon } from "@/lib/justConfirmed";
import type { BarlinEvent } from "@/types/event";
import { SHOW_INTEREST_COUNT } from "@/lib/featureFlags";

type OrganizerVenue = { name: string; address: string | null; neighborhood: string | null } | null;

const STATUS_STYLE: Record<string, string> = {
  approved: "border-green-600/40 bg-green-500/10 text-green-700",
  pending: "border-yellow-600/40 bg-yellow-500/10 text-yellow-700",
  rejected: "border-red-600/40 bg-red-500/10 text-red-700",
};

export default function OrganizerDashboard() {
  const { user, role, approvalStatus, loading, roleResolved } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [myEvents, setMyEvents] = useState<BarlinEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [venue, setVenue] = useState<OrganizerVenue>(null);
  const [venueLoading, setVenueLoading] = useState(true);

  const isApprovedAccess = role === "admin" || (role === "organizer" && approvalStatus === "approved");

  const [justConfirmed] = useState(consumeJustConfirmed);

  useEffect(() => {
    if (!justConfirmed) return;
    return clearJustConfirmedSoon();
  }, [justConfirmed]);

  useEffect(() => {
    if (!loading && roleResolved && role !== "organizer" && role !== "admin") {
      navigate("/", { replace: true });
    }
  }, [user, role, roleResolved, loading, navigate]);

  useEffect(() => {
    if (!user || !isApprovedAccess) return;
    fetchEventsByCreator(user.id)
      .then(setMyEvents)
      .catch(() => toast.error("Failed to load your events."))
      .finally(() => setEventsLoading(false));
  }, [user, isApprovedAccess]);

  useEffect(() => {
    if (!user || !isApprovedAccess) return;
    fetchOrganizerById(user.id)
      .then((organizer) => {
        if (organizer?.venue) setVenue(organizer.venue);
      })
      .finally(() => setVenueLoading(false));
  }, [user, isApprovedAccess]);

  const membersBySeries = useMemo(() => {
    const map = new Map<string, BarlinEvent[]>();
    for (const e of myEvents) {
      const seriesId = e.parentId || e.id;
      const arr = map.get(seriesId) ?? [];
      arr.push(e);
      map.set(seriesId, arr);
    }
    return map;
  }, [myEvents]);

  const liveMembers = (parent: BarlinEvent): BarlinEvent[] =>
    (membersBySeries.get(parent.id) ?? [parent]).filter((m) => m.status !== "canceled");

  const getNextUpcoming = (parent: BarlinEvent): BarlinEvent | null => {
    const upc = liveMembers(parent)
      .filter((m) => !isEventInPast(m))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    return upc[0] ?? null;
  };

  const getLastPast = (parent: BarlinEvent): BarlinEvent | null => {
    const past = liveMembers(parent)
      .filter((m) => isEventInPast(m))
      .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
    return past[0] ?? null;
  };

  const parents = myEvents.filter((e) => !e.parentId);
  const upcoming = parents
    .filter((p) => getNextUpcoming(p) !== null)
    .sort((a, b) => {
      const nA = getNextUpcoming(a)!;
      const nB = getNextUpcoming(b)!;
      return nA.date.localeCompare(nB.date) || nA.startTime.localeCompare(nB.startTime);
    });
  const past = parents
    .filter((p) => getNextUpcoming(p) === null && getLastPast(p) !== null)
    .sort((a, b) => {
      const lA = getLastPast(a)!;
      const lB = getLastPast(b)!;
      return lB.date.localeCompare(lA.date) || lB.startTime.localeCompare(lA.startTime);
    });
  const displayed = activeTab === "upcoming" ? upcoming : past;

  const INITIAL_COUNT = 5;
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  useEffect(() => { setShowAll(false); setExpandedId(null); }, [activeTab]);
  const visible = showAll ? displayed : displayed.slice(0, INITIAL_COUNT);
  const hasMore = displayed.length > INITIAL_COUNT;

  if (loading || !roleResolved) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (!user) return null;

  if (role === "organizer" && approvalStatus !== "approved") {
    const rejected = approvalStatus === "rejected";
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="w-full max-w-md mx-auto px-4 text-center space-y-5">
          {justConfirmed && (
              <div className="inline-flex items-center gap-2 border-2 border-foreground bg-green-500/10 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-green-700">
                <CheckCircle2 className="h-4 w-4" /> Email confirmed
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
            {!rejected && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                We do this to protect you and the bar community — only real owners or staff should be able to publish events for a bar.
              </p>
            )}
        </div>
      </div>
    );
  }

  if (eventsLoading || venueLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      {/* Sticky Back row — mirrors BarAccount/detail pages so the back
          affordance sits at the same screen position. */}
      <div className="sticky z-40 bg-background" style={{ top: "var(--header-h)" }}>
        <div className="container flex items-center py-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 p-2 -ml-2 text-foreground active:opacity-60 hover:opacity-70 transition-opacity"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]">Back</span>
          </button>
        </div>
      </div>
    <div className="container max-w-2xl pt-4 pb-8">
          {justConfirmed && (
            <div className="mb-6 inline-flex items-center gap-2 border-2 border-foreground bg-green-500/10 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-green-700">
              <CheckCircle2 className="h-4 w-4" /> Email confirmed
            </div>
          )}
          <div className="mb-6">
            <h1 className="heading-display text-4xl md:text-5xl leading-[0.95]">Your events</h1>
          </div>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[
              { label: "Total Events", value: String(myEvents.filter((e) => e.status !== "canceled").length), icon: CalendarDays },
              { label: "Upcoming", value: String(myEvents.filter((e) => e.status !== "canceled" && !isEventInPast(e)).length), icon: Clock },
            ].map((stat) => (
              <div key={stat.label} className="border-2 border-foreground p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</span>
                  <stat.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="font-serif text-3xl font-bold">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-8">
            <Link
              to="/publish"
              className="group inline-flex items-center gap-2 h-11 px-5 border-2 border-foreground bg-foreground font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-background hover:bg-background hover:text-foreground transition-colors"
            >
              <Plus className="h-4 w-4" /> {venue?.name ? `Publish events in your bar ${venue.name}` : "Publish events"}
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
          {eventsLoading && <div className="flex justify-center py-8"><Spinner /></div>}
          {!eventsLoading && displayed.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-base">No {activeTab} events yet.</p>
            </div>
          )}
          {!eventsLoading && displayed.length > 0 && (
            <div className="space-y-3">
              {visible.map((parent) => {
                const next = getNextUpcoming(parent);
                const displayEvent =
                  activeTab === "upcoming"
                    ? next ?? parent
                    : getLastPast(parent) ?? parent;
                const recurrenceLabel = formatRecurrenceLabel(parent.recurrence);
                const upcomingMembers = liveMembers(parent)
                  .filter((m) => !isEventInPast(m))
                  .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
                const pastMembers = liveMembers(parent)
                  .filter((m) => isEventInPast(m))
                  .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
                const expandedMembers = activeTab === "upcoming" ? upcomingMembers : pastMembers;
                const canExpand = expandedMembers.length > 1;
                const isExpanded = expandedId === parent.id;
                return (
                  <div
                    key={parent.id}
                    className="border-2 border-foreground p-5"
                  >
                    <div className="flex flex-col sm:flex-row gap-4">
                      {parent.image && (
                        <div className="w-full sm:w-28 h-24 overflow-hidden flex-shrink-0 bg-muted border-2 border-foreground">
                          <img
                            src={parent.image}
                            alt={parent.title}
                            style={{ objectPosition: parent.imagePosition }}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="font-serif text-base font-semibold break-all min-w-0">{parent.title}</span>
                          {recurrenceLabel && (
                            <span className="inline-flex items-center gap-1 border border-foreground/30 bg-muted px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              <Repeat className="h-3 w-3" /> {recurrenceLabel}
                            </span>
                          )}
                          {isEventStillOnline(displayEvent) && (
                            <span className={`border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[displayEvent.status ?? "pending"] ?? ""}`}>
                              {displayEvent.status === "approved" ? "online" : (displayEvent.status ?? "pending")}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {recurrenceLabel && next ? "Next: " : ""}
                          {formatDateWithDay(displayEvent.date)} · {displayEvent.startTime}{displayEvent.endTime ? ` – ${displayEvent.endTime}` : ""}
                        </p>
                        {SHOW_INTEREST_COUNT && (
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {displayEvent.interestedCount ?? 0} interested</span>
                          </div>
                        )}
                      </div>
                      <div className="flex sm:flex-col gap-3 sm:items-end justify-end flex-shrink-0">
                        {activeTab === "upcoming" ? (
                          canExpand ? (
                            displayEvent.status !== "canceled" && !hasEventStarted(displayEvent) && (
                              <Link
                                to={`/edit-event/${displayEvent.id}?scope=future`}
                                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Pencil className="h-4 w-4" /> Edit series
                              </Link>
                            )
                          ) : (
                            <>
                              {displayEvent.status !== "canceled" && (
                                <Link
                                  to={`/event/${displayEvent.id}`}
                                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <Eye className="h-4 w-4" /> View
                                </Link>
                              )}
                              {displayEvent.status !== "canceled" && !hasEventStarted(displayEvent) && (
                                <Link
                                  to={`/edit-event/${displayEvent.id}`}
                                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <Pencil className="h-4 w-4" /> Edit
                                </Link>
                              )}
                            </>
                          )
                        ) : (
                          !canExpand && displayEvent.status !== "canceled" && (
                            <Link
                              to={`/event/${displayEvent.id}`}
                              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Eye className="h-4 w-4" /> View
                            </Link>
                          )
                        )}
                        {canExpand && (
                          <button
                            type="button"
                            onClick={() => setExpandedId((prev) => (prev === parent.id ? null : parent.id))}
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? "Hide all dates" : "Show all dates"}
                            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                            {isExpanded ? "Hide dates" : `All ${expandedMembers.length} ${activeTab} dates`}
                          </button>
                        )}
                      </div>
                    </div>
                    {canExpand && isExpanded && (
                      <div className="mt-4 pt-2 border-t border-border divide-y divide-border/50">
                        {expandedMembers.map((m) => {
                          const canEdit = !hasEventStarted(m);
                          return (
                            <div
                              key={m.id}
                              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm py-2 px-2 -mx-2 hover:bg-muted/50"
                            >
                              <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                                <span className="text-muted-foreground">
                                  {formatDateWithDay(m.date)} · {m.startTime}{m.endTime ? ` – ${m.endTime}` : ""}
                                </span>
                              </div>
                              <div className="flex gap-3 sm:justify-end flex-shrink-0">
                                <Link
                                  to={`/event/${m.id}`}
                                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <Eye className="h-4 w-4" /> View
                                </Link>
                                {canEdit && (
                                  <Link
                                    to={`/edit-event/${m.id}?scope=single`}
                                    className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <Pencil className="h-4 w-4" /> Edit
                                  </Link>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {hasMore && !showAll && (
                <div className="pt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Show more ({displayed.length - INITIAL_COUNT})
                  </button>
                </div>
              )}
            </div>
          )}
    </div>
    </>
  );
}
