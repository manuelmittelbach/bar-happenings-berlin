import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDateWithDay, berlinDateString } from "@/lib/dateFormat";
import { Link, useNavigate } from "react-router-dom";
import { Eye, Pencil, Users, CalendarDays, CalendarPlus, Clock, Repeat, ChevronDown, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { fetchEventsByCreator, fetchMyStagedSubmissions, extendEventSeries } from "@/lib/supabaseQueries";
import { isEventInPast, isEventStillOnline, hasEventStarted } from "@/lib/eventStatus";
import { formatRecurrenceLabel, parseRule, generateOccurrences, defaultUntil } from "@/lib/recurrence";
import { Spinner } from "@/components/ui/spinner";
import { PageSpinner } from "@/components/ui/page-spinner";
import type { BarlinEvent } from "@/types/event";
import { SHOW_INTEREST_COUNT } from "@/lib/featureFlags";

const STATUS_STYLE: Record<string, string> = {
  approved: "border-green-600/40 bg-green-500/10 text-green-700",
  pending: "border-yellow-600/40 bg-yellow-500/10 text-yellow-700",
  rejected: "border-red-600/40 bg-red-500/10 text-red-700",
};

export default function OrganizerDashboard() {
  const { user, role, approvalStatus, loading, roleResolved } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");

  // Who may load + see the "Manage your events" content: admins, approved bar
  // owners, and now plain users (who see their own submitted events).
  const isApprovedAccess =
    role === "admin" || role === "user" || (role === "organizer" && approvalStatus === "approved");

  useEffect(() => {
    if (!loading && roleResolved && role !== "user" && role !== "organizer" && role !== "admin") {
      navigate("/", { replace: true });
    }
  }, [user, role, roleResolved, loading, navigate]);

  // Plain users' pending submissions now live in venue_events_staging, not
  // `events`, so merge their own staging rows (pending) with their approved
  // events. Organizers/admins publish straight to `events` and have none.
  //
  // refetchOnMount: "always" so opening this page always pulls the current DB
  // state. Publish (PublishEvent) and cancel/delete (the event editor) happen
  // on other routes, then navigate here — relying on invalidateQueries(["events"])
  // alone left the list stale until a manual refresh, since the remounting query
  // could still serve its cache (global staleTime is 1h). "always" refetches
  // regardless, so a freshly published or canceled event shows up immediately.
  const {
    data: myEvents = [],
    isLoading: eventsLoading,
    isError: myEventsError,
    refetch: refetchMyEvents,
  } = useQuery({
    queryKey: ["events", "by-creator", user?.id, role],
    enabled: !!user && isApprovedAccess,
    refetchOnMount: "always",
    queryFn: async () => {
      const [approvedEvents, pendingSubmissions] = await Promise.all([
        fetchEventsByCreator(user!.id),
        role === "user" ? fetchMyStagedSubmissions(user!.id) : Promise.resolve<BarlinEvent[]>([]),
      ]);
      return [...pendingSubmissions, ...approvedEvents];
    },
  });

  useEffect(() => {
    if (myEventsError) toast.error("Failed to load your events.");
  }, [myEventsError]);

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

  const totalEvents = myEvents.filter((e) => e.status !== "canceled").length;
  const parents = myEvents.filter((e) => !e.parentId);
  const upcoming = parents
    .filter((p) => getNextUpcoming(p) !== null)
    .sort((a, b) => {
      const nA = getNextUpcoming(a)!;
      const nB = getNextUpcoming(b)!;
      return nA.date.localeCompare(nB.date) || nA.startTime.localeCompare(nB.startTime);
    });
  // Past tab includes any series with at least one past occurrence — even if
  // the series still has upcoming dates. Otherwise past occurrences of active
  // series would be unreachable: they don't show up in the Upcoming card's
  // expanded view (filtered to future), and the series wouldn't appear in
  // Past until every date was over.
  const past = parents
    .filter((p) => getLastPast(p) !== null)
    .sort((a, b) => {
      const lA = getLastPast(a)!;
      const lB = getLastPast(b)!;
      return lB.date.localeCompare(lA.date) || lB.startTime.localeCompare(lA.startTime);
    });
  const displayed = activeTab === "upcoming" ? upcoming : past;

  const INITIAL_COUNT = 5;
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [extendingId, setExtendingId] = useState<string | null>(null);
  useEffect(() => { setShowAll(false); setExpandedId(null); }, [activeTab]);
  const visible = showAll ? displayed : displayed.slice(0, INITIAL_COUNT);
  const hasMore = displayed.length > INITIAL_COUNT;

  // Whether a series can gain at least one more occurrence inside the rolling
  // 6-months-from-today window. Anchored on the series' last existing date
  // (itself a valid occurrence, so it carries the same weekday/nth/parity),
  // which sidesteps the generateOccurrences 200-date cap. The RPC is the
  // authority on what actually gets inserted; this only gates the button.
  const canExtendSeries = (parent: BarlinEvent): boolean => {
    const freq = parseRule(parent.recurrence)?.freq;
    if (!freq) return false;
    const dates = (membersBySeries.get(parent.id) ?? [parent]).map((m) => m.date);
    const lastDate = dates.sort().at(-1);
    if (!lastDate) return false;
    return generateOccurrences(lastDate, freq, defaultUntil(berlinDateString())).length > 1;
  };

  const handleExtendSeries = async (parent: BarlinEvent) => {
    setExtendingId(parent.id);
    try {
      const added = await extendEventSeries(parent.id);
      if (added > 0) {
        toast.success(`${added} neue${added === 1 ? "r Termin" : " Termine"} hinzugefügt.`);
        await refetchMyEvents();
      } else {
        toast("Bereits bis zum Maximum (6 Monate) verlängert.");
      }
    } catch {
      toast.error("Serie konnte nicht verlängert werden.");
    } finally {
      setExtendingId(null);
    }
  };

  if (loading || !roleResolved) {
    return <PageSpinner />;
  }
  if (!user) return null;

  // Pending/rejected organizers never reach here — ProfileGate renders the
  // AwaitingApproval screen in place of every /profile page until approval.

  if (eventsLoading) {
    return <PageSpinner />;
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
          {/* Masthead — Bars-directory pattern: compact heading-display on
              a hairline rule. */}
          <header className="mb-6 md:mb-8">
            <div className="pt-2.5 pb-2.5 border-b-2 border-border">
              <h1 className="heading-display text-2xl md:text-[30px] leading-none m-0">Your events</h1>
            </div>
          </header>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[
              { label: "Total Events", value: String(totalEvents), icon: CalendarDays },
              { label: "Upcoming", value: String(myEvents.filter((e) => e.status !== "canceled" && !isEventInPast(e)).length), icon: Clock },
            ].map((stat) => (
              <div key={stat.label} className="border-2 border-foreground p-5 space-y-2 shadow-[0_18px_40px_-28px_hsla(18,85%,52%,0.3)]">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</span>
                  <stat.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="font-serif text-3xl font-bold">{stat.value}</p>
              </div>
            ))}
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
                const isSeries = !!parseRule(parent.recurrence)?.freq;
                const canExtend = isSeries && canExtendSeries(parent);
                const isExpanded = expandedId === parent.id;
                // A pending submission lives in venue_events_staging, not
                // `events`, so it has no /event/:id route — suppress View.
                // Edit is wired through: /edit-event/:id falls back to the
                // user's staging row when the live event isn't found.
                const isPendingSubmission = displayEvent.status === "pending";
                return (
                  <div
                    key={parent.id}
                    className="border-2 border-foreground p-5 shadow-[0_18px_40px_-28px_hsla(18,85%,52%,0.3)]"
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
                                to={`/edit-event/${displayEvent.id}?scope=future&from=my-events`}
                                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Pencil className="h-4 w-4" /> Edit series
                              </Link>
                            )
                          ) : (
                            <>
                              {!isPendingSubmission && displayEvent.status !== "canceled" && (
                                <Link
                                  to={`/event/${displayEvent.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <Eye className="h-4 w-4" /> View
                                </Link>
                              )}
                              {displayEvent.status !== "canceled" && !hasEventStarted(displayEvent) && (
                                <Link
                                  to={`/edit-event/${displayEvent.id}?from=my-events`}
                                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <Pencil className="h-4 w-4" /> Edit
                                </Link>
                              )}
                            </>
                          )
                        ) : (
                          !canExpand && !isPendingSubmission && displayEvent.status !== "canceled" && (
                            <Link
                              to={`/event/${displayEvent.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Eye className="h-4 w-4" /> View
                            </Link>
                          )
                        )}
                        {/* Extend a live recurring series with more dates, up to
                            6 months out. Shown for any series with an upcoming
                            occurrence (independent of canExpand, since a nearly
                            exhausted series is exactly when this matters most). */}
                        {activeTab === "upcoming" && isSeries && !isPendingSubmission
                          && displayEvent.status !== "canceled" && !hasEventStarted(displayEvent) && (
                          <button
                            type="button"
                            onClick={() => handleExtendSeries(parent)}
                            disabled={!canExtend || extendingId === parent.id}
                            title={canExtend
                              ? "Add more dates, up to 6 months from today"
                              : "Already extended to the maximum (6 months)"}
                            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted-foreground"
                          >
                            <CalendarPlus className="h-4 w-4" />
                            {extendingId === parent.id ? "Extending…" : "Extend series"}
                          </button>
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
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <Eye className="h-4 w-4" /> View
                                </Link>
                                {canEdit && (
                                  <Link
                                    to={`/edit-event/${m.id}?scope=single&from=my-events`}
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
