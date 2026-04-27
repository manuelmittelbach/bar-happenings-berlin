import { useState, useEffect, useCallback } from "react";
import { formatDateShort, formatDateWithDay } from "@/lib/dateFormat";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { endsNextDay } from "@/lib/eventStatus";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, X, Building2, Shield, Globe, Instagram, Phone, Edit, CalendarDays, ExternalLink, Plus, Copy, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { categories } from "@/data/categories";
import { LANGUAGES } from "@/data/languages";
import {
  fetchPendingOrganizers,
  fetchDecidedOrganizers,
  fetchVenuesWithOwnership,
  updateOrganizerApprovalStatus,
  approveOrganizerWithNewBar,
  approveOrganizerWithVenueClaim,
  setVenueOnline,
  updateVenueLinks,
  fetchStagedEvents,
  approveStagedEvent,
  rejectStagedEvent,
  fetchLiveEventsByVenue,
  fetchVenues,
  createBlankManualStagedEvent,
  duplicateStagedEvent,
  updateStagedEventManualFields,
  updateApprovedStagedEvent,
  type OrganizerAccount,
  type LiveEventInfo,
} from "@/lib/supabaseQueries";
import type { StagedEvent, StagedEventEdits, StagedEventStatusFilter, Venue } from "@/types/event";

type BarTab = "pending" | "overview" | "all-bars" | "scraped" | "manual";
type ScrapedTabFilter = StagedEventStatusFilter | "manual";

function openSourceWindow(url: string) {
  // Anchor to the monitor the user's browser is currently on (multi-monitor safe).
  const monitor = window.screen as Screen & { availLeft?: number; availTop?: number };
  const screenLeft = monitor.availLeft ?? 0;
  const screenTop = monitor.availTop ?? 0;
  const screenW = monitor.availWidth;
  const screenH = monitor.availHeight;

  const popupW = Math.floor(screenW / 2);
  const popupH = screenH;
  const popupLeft = screenLeft + (screenW - popupW);
  const popupTop = screenTop;

  window.open(
    url,
    "verify-source",
    `popup=true,left=${popupLeft},top=${popupTop},width=${popupW},height=${popupH},noopener,noreferrer`,
  );
}

export default function AdminDashboard() {
  const { user, role, loading, roleResolved } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeBarTab: BarTab =
    tabParam === "overview" ? "overview"
    : tabParam === "all-bars" ? "all-bars"
    : tabParam === "scraped" ? "scraped"
    : tabParam === "manual" ? "manual"
    : "pending";
  const setActiveBarTab = (tab: BarTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === "pending") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next);
  };

  const [pendingOrganizers, setPendingOrganizers] = useState<OrganizerAccount[]>([]);
  const [pendingOrganizersLoading, setPendingOrganizersLoading] = useState(true);
  const [decidedOrganizers, setDecidedOrganizers] = useState<OrganizerAccount[]>([]);
  const [decidedOrganizersLoading, setDecidedOrganizersLoading] = useState(true);
  const [allBars, setAllBars] = useState<{ venue: Venue; hasOwner: boolean }[]>([]);
  const [allBarsLoading, setAllBarsLoading] = useState(true);
  const [allBarsQuery, setAllBarsQuery] = useState("");
  const [scrapedEvents, setScrapedEvents] = useState<StagedEvent[]>([]);
  const [scrapedLoading, setScrapedLoading] = useState(true);
  const [scrapedFilter, setScrapedFilter] = useState<ScrapedTabFilter>("pending");
  const [scrapedQuery, setScrapedQuery] = useState("");
  const [manualEvents, setManualEvents] = useState<StagedEvent[]>([]);
  const [manualLoading, setManualLoading] = useState(true);
  const [manualFilter, setManualFilter] = useState<StagedEventStatusFilter>("pending");
  const [manualQuery, setManualQuery] = useState("");
  const [liveEventsByVenue, setLiveEventsByVenue] = useState<Record<string, LiveEventInfo[]>>({});
  const [venues, setVenues] = useState<Venue[]>([]);

  useEffect(() => {
    if (!loading && roleResolved && role !== "admin") navigate("/", { replace: true });
  }, [role, roleResolved, loading, navigate]);

  const loadPendingOrganizers = useCallback(async () => {
    setPendingOrganizersLoading(true);
    try {
      setPendingOrganizers(await fetchPendingOrganizers());
    } catch {
      toast.error("Failed to load pending bar accounts.");
    } finally {
      setPendingOrganizersLoading(false);
    }
  }, []);

  const loadDecidedOrganizers = useCallback(async () => {
    setDecidedOrganizersLoading(true);
    try {
      setDecidedOrganizers(await fetchDecidedOrganizers());
    } catch {
      toast.error("Failed to load bar accounts overview.");
    } finally {
      setDecidedOrganizersLoading(false);
    }
  }, []);

  const loadAllBars = useCallback(async () => {
    setAllBarsLoading(true);
    try {
      setAllBars(await fetchVenuesWithOwnership());
    } catch {
      toast.error("Failed to load bars.");
    } finally {
      setAllBarsLoading(false);
    }
  }, []);

  const loadScrapedEvents = useCallback(async () => {
    setScrapedLoading(true);
    try {
      if (scrapedFilter === "manual") {
        // Client-side filter to is_manual=true within scraped scope
        const all = await fetchStagedEvents("all", "scraped");
        setScrapedEvents(all.filter(s => s.isManual));
      } else {
        setScrapedEvents(await fetchStagedEvents(scrapedFilter, "scraped"));
      }
    } catch {
      toast.error("Failed to load scraped events.");
    } finally {
      setScrapedLoading(false);
    }
  }, [scrapedFilter]);

  const loadManualEvents = useCallback(async () => {
    setManualLoading(true);
    try {
      setManualEvents(await fetchStagedEvents(manualFilter, "manual"));
    } catch {
      toast.error("Failed to load manual events.");
    } finally {
      setManualLoading(false);
    }
  }, [manualFilter]);

  const loadLiveEvents = useCallback(async () => {
    try {
      setLiveEventsByVenue(await fetchLiveEventsByVenue());
    } catch {
      // Silent — non-critical context info.
    }
  }, []);

  const loadVenues = useCallback(async () => {
    try {
      const list = await fetchVenues();
      list.sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
      setVenues(list);
    } catch {
      // Silent — fallback: dropdown will be empty.
    }
  }, []);

  useEffect(() => {
    loadPendingOrganizers();
    loadDecidedOrganizers();
    loadAllBars();
    loadVenues();
  }, [loadPendingOrganizers, loadDecidedOrganizers, loadAllBars, loadVenues]);

  useEffect(() => {
    loadScrapedEvents();
  }, [loadScrapedEvents]);

  useEffect(() => {
    loadManualEvents();
  }, [loadManualEvents]);

  useEffect(() => {
    loadLiveEvents();
  }, [loadLiveEvents]);

  const handleApproveOrganizer = async (organizer: OrganizerAccount) => {
    if (!user) return;
    if (organizer.orphaned) {
      toast.error("Can't approve — venue was deleted. Please reject this organizer.");
      return;
    }
    try {
      const label =
        organizer.venue?.name ??
        organizer.pendingSubmission?.name ??
        organizer.pendingClaim?.venueName ??
        organizer.email ??
        "Bar";
      let approvedVenue: OrganizerAccount["venue"] = organizer.venue;
      if (organizer.pendingSubmission && !organizer.venue) {
        await approveOrganizerWithNewBar(organizer.id, user.id);
        approvedVenue = {
          id: "",
          name: organizer.pendingSubmission.name,
          address: organizer.pendingSubmission.address,
          neighborhood: organizer.pendingSubmission.neighborhood,
          website: organizer.pendingSubmission.website,
          instagram: organizer.pendingSubmission.instagram,
          phone: organizer.pendingSubmission.phone,
        };
        loadAllBars();
      } else if (organizer.pendingClaim && !organizer.venue) {
        await approveOrganizerWithVenueClaim(organizer.id, user.id);
        approvedVenue = {
          id: organizer.pendingClaim.venueId,
          name: organizer.pendingClaim.venueName,
          address: organizer.pendingClaim.venueAddress,
          neighborhood: organizer.pendingClaim.venueNeighborhood,
          website: organizer.pendingClaim.proposedWebsite ?? organizer.pendingClaim.venueWebsite,
          instagram: organizer.pendingClaim.proposedInstagram ?? organizer.pendingClaim.venueInstagram,
          phone: organizer.pendingClaim.proposedPhone ?? organizer.pendingClaim.venuePhone,
        };
        loadAllBars();
      } else {
        await updateOrganizerApprovalStatus(organizer.id, "approved", user.id);
      }
      toast.success(`${label} approved`);
      setPendingOrganizers(prev => prev.filter(o => o.id !== organizer.id));
      const decided: OrganizerAccount = {
        ...organizer,
        approvalStatus: "approved",
        approvedBy: user.id,
        approvedAt: new Date().toISOString(),
        venue: approvedVenue,
        pendingSubmission: null,
        pendingClaim: null,
      };
      setDecidedOrganizers(prev => [decided, ...prev]);
    } catch {
      toast.error("Failed to approve bar account.");
    }
  };

  const handleVenueLinkChange = async (
    venueId: string,
    patch: { website?: string | null; instagram?: string | null; websiteEvents?: string | null },
  ) => {
    setAllBars(prev =>
      prev.map(item =>
        item.venue.id === venueId
          ? {
              ...item,
              venue: {
                ...item.venue,
                ...(patch.website !== undefined ? { website: patch.website ?? undefined } : {}),
                ...(patch.instagram !== undefined ? { instagram: patch.instagram ?? undefined } : {}),
                ...(patch.websiteEvents !== undefined ? { websiteEvents: patch.websiteEvents ?? undefined } : {}),
              },
            }
          : item,
      ),
    );
    try {
      await updateVenueLinks(venueId, patch);
    } catch {
      toast.error("Couldn't save link. Please try again.");
      loadAllBars();
    }
  };

  const handleToggleOnline = async (venueId: string, next: "yes" | "no") => {
    setAllBars(prev =>
      prev.map(item =>
        item.venue.id === venueId ? { ...item, venue: { ...item.venue, online: next } } : item,
      ),
    );
    try {
      await setVenueOnline(venueId, next);
    } catch {
      setAllBars(prev =>
        prev.map(item =>
          item.venue.id === venueId
            ? { ...item, venue: { ...item.venue, online: next === "yes" ? "no" : "yes" } }
            : item,
        ),
      );
      toast.error("Couldn't update online status. Please try again.");
    }
  };

  const handleApproveStaged = async (staged: StagedEvent, edits: StagedEventEdits) => {
    if (!user) return;
    try {
      await approveStagedEvent(staged, user.id, edits);
      toast.success(`"${edits.title ?? staged.title}" approved`);
      setScrapedEvents(prev => prev.filter(s => s.id !== staged.id));
      setManualEvents(prev => prev.filter(s => s.id !== staged.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to approve event.";
      toast.error(message);
    }
  };

  const handleRejectStaged = async (staged: StagedEvent) => {
    if (!user) return;
    try {
      await rejectStagedEvent(staged.id, user.id);
      toast.error(`"${staged.title}" rejected`);
      setScrapedEvents(prev => prev.filter(s => s.id !== staged.id));
      setManualEvents(prev => prev.filter(s => s.id !== staged.id));
    } catch {
      toast.error("Failed to reject event.");
    }
  };

  const handleCreateBlank = async (scope: "scraped" | "manual") => {
    if (venues.length === 0) {
      toast.error("No venues available.");
      return;
    }
    try {
      const created = await createBlankManualStagedEvent(venues[0].id, scope);
      if (scope === "manual") {
        setManualFilter("pending");
        setManualEvents(prev => [created, ...prev.filter(s => s.id !== created.id)]);
      } else {
        // Force a status pill (not "Created Manually") so the new pending blank shows up
        if (scrapedFilter !== "pending") setScrapedFilter("pending");
        setScrapedEvents(prev => [created, ...prev.filter(s => s.id !== created.id)]);
      }
      toast.success("Blank card created");
    } catch {
      toast.error("Failed to create card.");
    }
  };

  const handleDuplicateStaged = async (source: StagedEvent, edits: StagedEventEdits) => {
    try {
      const created = await duplicateStagedEvent(source, edits);
      const insertAfterSource = (prev: StagedEvent[]) => {
        const idx = prev.findIndex(s => s.id === source.id);
        if (idx === -1) return [created, ...prev];
        return [...prev.slice(0, idx + 1), created, ...prev.slice(idx + 1)];
      };
      if (created.isManualTab) {
        setManualEvents(insertAfterSource);
      } else {
        setScrapedEvents(insertAfterSource);
      }
      toast.success("Card duplicated");
    } catch {
      toast.error("Failed to duplicate card.");
    }
  };

  const handleManualVenueChange = async (stagedId: string, venueId: string) => {
    try {
      await updateStagedEventManualFields(stagedId, { venueId });
      const venue = venues.find(v => v.id === venueId);
      if (!venue) return;
      const apply = (prev: StagedEvent[]) =>
        prev.map(s =>
          s.id === stagedId
            ? {
                ...s,
                venueId,
                venueName: venue.name,
                venueAddress: venue.address,
                venueNeighborhood: venue.neighborhood,
              }
            : s,
        );
      setScrapedEvents(apply);
      setManualEvents(apply);
    } catch {
      toast.error("Failed to update venue.");
    }
  };

  const handleManualSourceUrlChange = async (stagedId: string, sourceUrl: string) => {
    const value = sourceUrl.trim() || null;
    try {
      await updateStagedEventManualFields(stagedId, { sourceUrl: value });
      const apply = (prev: StagedEvent[]) =>
        prev.map(s => (s.id === stagedId ? { ...s, sourceUrl: value } : s));
      setScrapedEvents(apply);
      setManualEvents(apply);
    } catch {
      toast.error("Failed to update URL.");
    }
  };

  const handleSaveApprovedStaged = async (staged: StagedEvent, edits: StagedEventEdits) => {
    try {
      await updateApprovedStagedEvent(staged, edits, venues);
      toast.success("Event updated");
      const newVenue = edits.venueId ? venues.find(v => v.id === edits.venueId) : null;
      const apply = (prev: StagedEvent[]) =>
        prev.map(s => {
          if (s.id !== staged.id) return s;
          return {
            ...s,
            title: edits.title ?? s.title,
            date: edits.date ?? s.date,
            startTime: edits.startTime !== undefined ? edits.startTime : s.startTime,
            endTime: edits.endTime !== undefined ? edits.endTime : s.endTime,
            category: edits.category !== undefined ? edits.category : s.category,
            language: edits.language ?? s.language,
            description: edits.description ?? s.description,
            entryInfo: edits.entryInfo ?? s.entryInfo,
            sourceUrl: edits.sourceUrl !== undefined ? edits.sourceUrl : s.sourceUrl,
            venueId: newVenue?.id ?? s.venueId,
            venueName: newVenue?.name ?? s.venueName,
            venueAddress: newVenue?.address ?? s.venueAddress,
            venueNeighborhood: newVenue?.neighborhood ?? s.venueNeighborhood,
          };
        });
      setScrapedEvents(apply);
      setManualEvents(apply);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save changes.";
      toast.error(message);
    }
  };

  const handleRejectOrganizer = async (organizer: OrganizerAccount) => {
    try {
      await updateOrganizerApprovalStatus(organizer.id, "rejected");
      const label =
        organizer.venue?.name ??
        organizer.pendingSubmission?.name ??
        organizer.pendingClaim?.venueName ??
        organizer.email ??
        "Bar";
      toast.error(`${label} rejected`);
      setPendingOrganizers(prev => prev.filter(o => o.id !== organizer.id));
      const decided: OrganizerAccount = {
        ...organizer,
        approvalStatus: "rejected",
        approvedBy: null,
        approvedAt: null,
        pendingSubmission: null,
        pendingClaim: null,
        orphaned: false,
      };
      setDecidedOrganizers(prev => [decided, ...prev]);
    } catch {
      toast.error("Failed to reject bar account.");
    }
  };

  if (loading || !roleResolved) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (role !== "admin") return null;

  return (
    <div className="container py-8">
          <div className="flex items-center gap-2 mb-8">
            <Shield className="h-5 w-5 text-accent" />
            <h1 className="heading-display text-3xl">Admin Dashboard</h1>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 max-w-md">
            <div className="border border-border rounded-sm p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Pending Bars</span>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
              {pendingOrganizersLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <p className="font-heading text-2xl font-bold">{String(pendingOrganizers.length)}</p>
              )}
            </div>
            <div className="border border-border rounded-sm p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Total Decided</span>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
              {decidedOrganizersLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <p className="font-heading text-2xl font-bold">{String(decidedOrganizers.length)}</p>
              )}
            </div>
          </div>

          {/* Bar Accounts sub-tabs */}
          <div className="flex gap-4 border-b border-border mb-6 overflow-x-auto">
            {(["overview", "pending", "all-bars", "scraped", "manual"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveBarTab(tab)}
                className={`pb-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  activeBarTab === tab ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "pending"
                  ? pendingOrganizersLoading ? "Pending" : `Pending (${pendingOrganizers.length})`
                  : tab === "overview"
                  ? decidedOrganizersLoading ? "Overview" : `Overview (${decidedOrganizers.length})`
                  : tab === "all-bars"
                  ? allBarsLoading ? "All Bars" : `All Bars (${allBars.length})`
                  : tab === "scraped"
                  ? scrapedLoading ? "Scraped Events" : `Scraped Events (${scrapedEvents.length})`
                  : manualLoading ? "Manual Events" : `Manual Events (${manualEvents.length})`}
              </button>
            ))}
          </div>

          {activeBarTab === "pending" && (
            <div className="space-y-3">
              {pendingOrganizersLoading && <div className="flex justify-center py-4"><Spinner /></div>}
              {!pendingOrganizersLoading && pendingOrganizers.length === 0 && (
                <p className="text-sm text-muted-foreground">No bar accounts pending review.</p>
              )}
              {pendingOrganizers.map((organizer) => (
                <OrganizerCard
                  key={organizer.id}
                  organizer={organizer}
                  onApprove={() => handleApproveOrganizer(organizer)}
                  onReject={() => handleRejectOrganizer(organizer)}
                  returnPath="/admin"
                />
              ))}
            </div>
          )}

          {activeBarTab === "overview" && (
            <div className="space-y-3">
              {decidedOrganizersLoading && <div className="flex justify-center py-4"><Spinner /></div>}
              {!decidedOrganizersLoading && decidedOrganizers.length === 0 && (
                <p className="text-sm text-muted-foreground">No bar accounts approved or rejected yet.</p>
              )}
              {decidedOrganizers.map((organizer) => (
                <OrganizerCard key={organizer.id} organizer={organizer} returnPath="/admin?tab=overview" />
              ))}
            </div>
          )}

          {activeBarTab === "scraped" && (
            <StagedEventsList
              events={scrapedEvents}
              loading={scrapedLoading}
              filter={scrapedFilter}
              onFilterChange={setScrapedFilter}
              query={scrapedQuery}
              onQueryChange={setScrapedQuery}
              showCreatedManuallyPill={true}
              hideManualBadge={false}
              venues={venues}
              liveEventsByVenue={liveEventsByVenue}
              onApprove={handleApproveStaged}
              onReject={handleRejectStaged}
              onDuplicate={handleDuplicateStaged}
              onVenueChange={handleManualVenueChange}
              onSourceUrlChange={handleManualSourceUrlChange}
              onSaveApproved={handleSaveApprovedStaged}
              emptyLabel="scraped"
            />
          )}

          {activeBarTab === "manual" && (
            <StagedEventsList
              events={manualEvents}
              loading={manualLoading}
              filter={manualFilter}
              onFilterChange={(f) => setManualFilter(f as StagedEventStatusFilter)}
              query={manualQuery}
              onQueryChange={setManualQuery}
              showCreatedManuallyPill={false}
              hideManualBadge={true}
              onCreateBlank={() => handleCreateBlank("manual")}
              venues={venues}
              liveEventsByVenue={liveEventsByVenue}
              onApprove={handleApproveStaged}
              onReject={handleRejectStaged}
              onDuplicate={handleDuplicateStaged}
              onVenueChange={handleManualVenueChange}
              onSourceUrlChange={handleManualSourceUrlChange}
              onSaveApproved={handleSaveApprovedStaged}
              emptyLabel="manual"
            />
          )}

          {activeBarTab === "all-bars" && (
            <div className="space-y-3">
              {allBarsLoading && <div className="flex justify-center py-4"><Spinner /></div>}
              {!allBarsLoading && (
                <>
                  <input
                    type="search"
                    value={allBarsQuery}
                    onChange={(e) => setAllBarsQuery(e.target.value)}
                    placeholder="Search by name, address or neighborhood…"
                    className="w-full h-10 px-3 mb-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                  />
                  {(() => {
                    const q = allBarsQuery.trim().toLowerCase();
                    const filtered = q
                      ? allBars.filter(({ venue }) =>
                          venue.name.toLowerCase().includes(q) ||
                          venue.address.toLowerCase().includes(q) ||
                          venue.neighborhood.toLowerCase().includes(q),
                        )
                      : allBars;
                    if (filtered.length === 0) {
                      return <p className="text-sm text-muted-foreground">No bars match your search.</p>;
                    }
                    return filtered.map(({ venue, hasOwner }) => (
                      <BarCard
                        key={venue.id}
                        venue={venue}
                        hasOwner={hasOwner}
                        onToggleOnline={handleToggleOnline}
                        onLinkChange={handleVenueLinkChange}
                      />
                    ));
                  })()}
                </>
              )}
            </div>
          )}
    </div>
  );
}

function BarCard({
  venue,
  hasOwner,
  onToggleOnline,
  onLinkChange,
}: {
  venue: Venue;
  hasOwner: boolean;
  onToggleOnline: (venueId: string, next: "yes" | "no") => void;
  onLinkChange: (
    venueId: string,
    patch: { website?: string | null; instagram?: string | null; websiteEvents?: string | null },
  ) => Promise<void>;
}) {
  const [website, setWebsite] = useState(venue.website ?? "");
  const [instagram, setInstagram] = useState(venue.instagram ?? "");
  const [websiteEvents, setWebsiteEvents] = useState(venue.websiteEvents ?? "");

  useEffect(() => { setWebsite(venue.website ?? ""); }, [venue.website]);
  useEffect(() => { setInstagram(venue.instagram ?? ""); }, [venue.instagram]);
  useEffect(() => { setWebsiteEvents(venue.websiteEvents ?? ""); }, [venue.websiteEvents]);

  const persistIfChanged = (
    field: "website" | "instagram" | "websiteEvents",
    current: string,
    original: string | undefined,
  ) => {
    const next = current.trim() || null;
    if (next === (original ?? null)) return;
    onLinkChange(venue.id, { [field]: next });
  };

  const instagramHref = instagram
    ? /^https?:\/\//i.test(instagram)
      ? instagram
      : `https://instagram.com/${instagram.replace(/^@/, "")}`
    : null;

  return (
    <div className="border border-border rounded-sm p-4 flex flex-col sm:flex-row sm:items-start gap-3">
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-heading text-sm font-semibold">{venue.name}</p>
          <span
            className={`text-xs px-2 py-0.5 rounded-sm font-medium ${
              hasOwner ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
            }`}
          >
            {hasOwner ? "Claimed" : "Unclaimed"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {venue.neighborhood || "(no neighborhood)"}
          {venue.address ? ` · ${venue.address}` : ""}
        </p>
        <div className="flex flex-col sm:flex-row gap-1.5 text-xs">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              value={website}
              onChange={e => setWebsite(e.target.value)}
              onBlur={() => persistIfChanged("website", website, venue.website)}
              placeholder="Website…"
              className="flex-1 min-w-0 h-7 px-2 bg-muted/50 border border-border rounded-sm text-xs outline-none focus:border-foreground transition-colors"
            />
            {venue.website && (
              <a
                href={venue.website}
                target="_blank"
                rel="noreferrer"
                title="Open"
                className="inline-flex items-center justify-center h-7 w-7 border border-border rounded-sm hover:bg-muted flex-shrink-0"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Instagram className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              value={instagram}
              onChange={e => setInstagram(e.target.value)}
              onBlur={() => persistIfChanged("instagram", instagram, venue.instagram)}
              placeholder="Instagram…"
              className="flex-1 min-w-0 h-7 px-2 bg-muted/50 border border-border rounded-sm text-xs outline-none focus:border-foreground transition-colors"
            />
            {instagramHref && (
              <a
                href={instagramHref}
                target="_blank"
                rel="noreferrer"
                title="Open"
                className="inline-flex items-center justify-center h-7 w-7 border border-border rounded-sm hover:bg-muted flex-shrink-0"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <CalendarDays className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              value={websiteEvents}
              onChange={e => setWebsiteEvents(e.target.value)}
              onBlur={() => persistIfChanged("websiteEvents", websiteEvents, venue.websiteEvents)}
              placeholder="Events page URL…"
              className="flex-1 min-w-0 h-7 px-2 bg-muted/50 border border-border rounded-sm text-xs outline-none focus:border-foreground transition-colors"
            />
            {venue.websiteEvents && (
              <a
                href={venue.websiteEvents}
                target="_blank"
                rel="noreferrer"
                title="Open"
                className="inline-flex items-center justify-center h-7 w-7 border border-border rounded-sm hover:bg-muted flex-shrink-0"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => onToggleOnline(venue.id, venue.online === "yes" ? "no" : "yes")}
          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-sm text-xs font-medium border transition-colors ${
            venue.online === "yes"
              ? "bg-green-500/10 text-green-600 border-green-500/40 hover:bg-green-500/20"
              : "bg-red-500/10 text-red-600 border-red-500/40 hover:bg-red-500/20"
          }`}
          title={`Online: ${venue.online}. Click to toggle.`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${venue.online === "yes" ? "bg-green-500" : "bg-red-500"}`} />
          Online: {venue.online}
        </button>
      </div>
    </div>
  );
}

function OrganizerCard({
  organizer,
  onApprove,
  onReject,
  returnPath,
}: {
  organizer: OrganizerAccount;
  onApprove?: () => void;
  onReject?: () => void;
  returnPath: string;
}) {
  const fullName = `${organizer.firstName} ${organizer.lastName}`.trim();
  const submitted = organizer.createdAt ? formatDateShort(organizer.createdAt.split("T")[0]) : null;
  const decided = organizer.approvedAt ? formatDateShort(organizer.approvedAt.split("T")[0]) : null;
  const statusPill =
    organizer.approvalStatus === "approved"
      ? "bg-green-500/10 text-green-600"
      : organizer.approvalStatus === "rejected"
      ? "bg-red-500/10 text-red-600"
      : "bg-yellow-500/10 text-yellow-600";

  // Display unifies venue / pendingSubmission / pendingClaim — admin sees consistent fields.
  const display = organizer.venue
    ? {
        name: organizer.venue.name,
        address: organizer.venue.address,
        neighborhood: organizer.venue.neighborhood,
        website: organizer.venue.website,
        instagram: organizer.venue.instagram,
        phone: organizer.venue.phone,
      }
    : organizer.pendingSubmission
    ? {
        name: organizer.pendingSubmission.name,
        address: organizer.pendingSubmission.address,
        neighborhood: organizer.pendingSubmission.neighborhood,
        website: organizer.pendingSubmission.website,
        instagram: organizer.pendingSubmission.instagram,
        phone: organizer.pendingSubmission.phone,
      }
    : organizer.pendingClaim
    ? {
        name: organizer.pendingClaim.venueName,
        address: organizer.pendingClaim.venueAddress,
        neighborhood: organizer.pendingClaim.venueNeighborhood,
        // Show proposed if set, else current venue value
        website: organizer.pendingClaim.proposedWebsite ?? organizer.pendingClaim.venueWebsite,
        instagram: organizer.pendingClaim.proposedInstagram ?? organizer.pendingClaim.venueInstagram,
        phone: organizer.pendingClaim.proposedPhone ?? organizer.pendingClaim.venuePhone,
      }
    : null;
  const isSubmittedBar = !organizer.venue && !!organizer.pendingSubmission;
  const isClaim = !organizer.venue && !!organizer.pendingClaim;

  return (
    <div className="border border-border rounded-sm p-4 flex flex-col sm:flex-row sm:items-start gap-3">
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-heading text-sm font-semibold">{display?.name ?? "(no venue)"}</p>
          {isSubmittedBar && (
            <span className="text-xs px-2 py-0.5 rounded-sm font-medium bg-blue-500/10 text-blue-600">
              Bar not yet in table
            </span>
          )}
          {isClaim && (
            <span className="text-xs px-2 py-0.5 rounded-sm font-medium bg-yellow-500/10 text-yellow-700">
              Bar already in table — organizer might have changed: email, website, instagram, phone
            </span>
          )}
          {organizer.orphaned && (
            <span className="text-xs px-2 py-0.5 rounded-sm font-medium bg-red-500/10 text-red-600">
              Orphaned — venue was deleted
            </span>
          )}
          {organizer.approvalStatus !== "pending" && (
            <span className={`text-xs px-2 py-0.5 rounded-sm font-medium capitalize ${statusPill}`}>
              {organizer.approvalStatus}
            </span>
          )}
        </div>
        {display && (
          <p className="text-xs text-muted-foreground">
            {display.neighborhood}
            {display.address ? ` · ${display.address}` : ""}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {fullName || "(no name)"}
          {organizer.email ? ` · ${organizer.email}` : ""}
        </p>
        {display && (display.website || display.instagram || display.phone) && (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {display.website && (
              <a
                href={display.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Globe className="h-3 w-3" /> {display.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {display.instagram && (
              <a
                href={
                  /^https?:\/\//i.test(display.instagram)
                    ? display.instagram
                    : `https://instagram.com/${display.instagram.replace(/^@/, "")}`
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Instagram className="h-3 w-3" /> {display.instagram.replace(/^https?:\/\//, "")}
              </a>
            )}
            {display.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" /> {display.phone}
              </span>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {submitted && <>Submitted {submitted}</>}
          {decided && organizer.approvalStatus === "approved" && <> · Approved {decided}</>}
        </p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        {(organizer.venue || organizer.pendingSubmission || organizer.pendingClaim) && (
          <Link
            to={`/admin/bar-account/${organizer.id}`}
            state={{ returnPath }}
            className="inline-flex items-center gap-1 h-8 px-3 border border-border rounded-sm text-xs font-medium hover:bg-muted"
            title="Edit"
          >
            <Edit className="h-3 w-3" /> Edit
          </Link>
        )}
        {onApprove && (
          <button
            onClick={onApprove}
            disabled={organizer.orphaned}
            title={organizer.orphaned ? "Venue was deleted — please reject this organizer" : undefined}
            className="inline-flex items-center gap-1 h-8 px-3 bg-foreground text-background rounded-sm text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="h-3 w-3" /> Approve
          </button>
        )}
        {onReject && (
          <button
            onClick={onReject}
            className="inline-flex items-center gap-1 h-8 px-3 border border-border rounded-sm text-xs font-medium hover:bg-muted"
          >
            <X className="h-3 w-3" /> Reject
          </button>
        )}
      </div>
    </div>
  );
}

function StagedEventCard({
  staged,
  liveEvents,
  venues,
  hideManualBadge,
  onApprove,
  onReject,
  onDuplicate,
  onVenueChange,
  onSourceUrlChange,
  onSaveApproved,
}: {
  staged: StagedEvent;
  liveEvents: LiveEventInfo[];
  venues: Venue[];
  hideManualBadge: boolean;
  onApprove: (edits: StagedEventEdits) => Promise<void>;
  onReject: () => void;
  onDuplicate: (edits: StagedEventEdits) => Promise<void>;
  onVenueChange: (venueId: string) => Promise<void>;
  onSourceUrlChange: (url: string) => Promise<void>;
  onSaveApproved: (edits: StagedEventEdits) => Promise<void>;
}) {
  const [title, setTitle] = useState(staged.title);
  const [date, setDate] = useState(staged.date);
  const [startTime, setStartTime] = useState(staged.startTime ?? "");
  const [endTime, setEndTime] = useState(staged.endTime ?? "");
  const [category, setCategory] = useState(staged.category ?? "");
  const [language, setLanguage] = useState(staged.language);
  const [description, setDescription] = useState(staged.description);
  const [entryInfo, setEntryInfo] = useState(staged.entryInfo);
  const [sourceUrlInput, setSourceUrlInput] = useState(staged.sourceUrl ?? "");
  const [venueIdLocal, setVenueIdLocal] = useState(staged.venueId);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingClash, setConfirmingClash] = useState(false);

  // Re-sync local state when the underlying staged row changes from outside
  // (e.g., after a save the parent updates the list — without this the
  // dirty-check below would see local !== staged and keep showing Save).
  useEffect(() => { setTitle(staged.title); }, [staged.title]);
  useEffect(() => { setDate(staged.date); }, [staged.date]);
  useEffect(() => { setStartTime(staged.startTime ?? ""); }, [staged.startTime]);
  useEffect(() => { setEndTime(staged.endTime ?? ""); }, [staged.endTime]);
  useEffect(() => { setCategory(staged.category ?? ""); }, [staged.category]);
  useEffect(() => { setLanguage(staged.language); }, [staged.language]);
  useEffect(() => { setDescription(staged.description); }, [staged.description]);
  useEffect(() => { setEntryInfo(staged.entryInfo); }, [staged.entryInfo]);
  useEffect(() => { setSourceUrlInput(staged.sourceUrl ?? ""); }, [staged.sourceUrl]);
  useEffect(() => { setVenueIdLocal(staged.venueId); }, [staged.venueId]);

  const liveDates = Array.from(new Set(liveEvents.map(e => e.date))).sort();
  const sameDayEvents = liveEvents.filter(e => e.date === date);

  const isPending = staged.status === "pending";
  const isApproved = staged.status === "approved";
  const isOrphanedApproved = isApproved && !staged.eventsId;
  const canEdit = isPending || (isApproved && !!staged.eventsId);
  const isManual = staged.isManual;
  const canEditManualFields = canEdit && (isManual || isApproved);
  const isDirty =
    title !== staged.title ||
    date !== staged.date ||
    startTime !== (staged.startTime ?? "") ||
    endTime !== (staged.endTime ?? "") ||
    category !== (staged.category ?? "") ||
    language !== staged.language ||
    description !== staged.description ||
    entryInfo !== staged.entryInfo ||
    sourceUrlInput !== (staged.sourceUrl ?? "") ||
    venueIdLocal !== staged.venueId;
  const statusPill =
    staged.status === "approved"
      ? "bg-green-500/10 text-green-600"
      : staged.status === "rejected"
      ? "bg-red-500/10 text-red-600"
      : "bg-yellow-500/10 text-yellow-600";

  const collectEdits = (): StagedEventEdits => ({
    title: title.trim(),
    date,
    startTime: startTime || null,
    endTime: endTime || null,
    category: category || null,
    language,
    description,
    entryInfo,
    ...(canEditManualFields ? { sourceUrl: sourceUrlInput.trim() || null } : {}),
    ...(isApproved ? { venueId: venueIdLocal } : {}),
  });

  const performApprove = async () => {
    setSubmitting(true);
    try {
      await onApprove(collectEdits());
    } finally {
      setSubmitting(false);
      setConfirmingClash(false);
    }
  };

  const handleApprove = async () => {
    if (sameDayEvents.length > 0 && !confirmingClash) {
      setConfirmingClash(true);
      return;
    }
    await performApprove();
  };

  const handleDuplicateClick = async () => {
    setSubmitting(true);
    try {
      await onDuplicate(collectEdits());
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveApprovedClick = async () => {
    setSubmitting(true);
    try {
      await onSaveApproved(collectEdits());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-border rounded-sm p-4 space-y-3">
      {isOrphanedApproved && (
        <p className="text-xs text-muted-foreground italic border border-border rounded-sm px-2 py-1.5 bg-muted/30">
          Cannot edit — link to live event missing.
        </p>
      )}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          {canEditManualFields ? (
            <select
              value={isApproved ? venueIdLocal : staged.venueId}
              onChange={e => {
                if (isApproved) setVenueIdLocal(e.target.value);
                else onVenueChange(e.target.value);
              }}
              className="h-8 px-2 bg-muted/50 border border-border rounded-sm text-sm font-heading font-semibold outline-none focus:border-foreground transition-colors"
            >
              {venues.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          ) : (
            <p className="font-heading text-sm font-semibold">{staged.venueName}</p>
          )}
          <span className="text-xs text-muted-foreground">{staged.venueNeighborhood}</span>
          {isManual && !hideManualBadge && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-red-500/10 text-red-600 border border-red-500/40">
              Created Manually
            </span>
          )}
          {!isPending && (
            <span className={`text-xs px-2 py-0.5 rounded-sm font-medium capitalize ${statusPill}`}>
              {staged.status}
            </span>
          )}
        </div>
        {isPending && (
          <button
            onClick={handleDuplicateClick}
            disabled={submitting}
            title="Duplicate this card"
            className="inline-flex items-center justify-center h-8 w-8 border border-border rounded-sm hover:bg-muted disabled:opacity-50 flex-shrink-0"
          >
            <Copy className="h-4 w-4" />
          </button>
        )}
      </div>

      {canEdit ? (
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={sourceUrlInput}
            onChange={e => setSourceUrlInput(e.target.value)}
            onBlur={() => {
              // Pending: persist immediately to DB on blur. Approved: collected via Save button.
              if (isPending && (sourceUrlInput.trim() || null) !== staged.sourceUrl) {
                onSourceUrlChange(sourceUrlInput);
              }
            }}
            placeholder="Source URL (optional)"
            className="flex-1 h-9 px-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
          />
          {staged.sourceUrl && (
            <button
              onClick={() => openSourceWindow(staged.sourceUrl!)}
              title="Open source in side window"
              className="inline-flex items-center justify-center h-9 w-9 border border-border rounded-sm hover:bg-muted flex-shrink-0"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        staged.sourceUrl && (
          <a
            href={staged.sourceUrl}
            onClick={(e) => {
              e.preventDefault();
              openSourceWindow(staged.sourceUrl!);
            }}
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline break-all max-w-full cursor-pointer"
            title="Open source page in side window to verify"
          >
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{staged.sourceUrl.replace(/^https?:\/\//, "")}</span>
          </a>
        )
      )}

      {liveDates.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Already live ({liveDates.length}): {liveDates.map(formatDateShort).join(", ")}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title"
          disabled={!canEdit}
          className="h-9 px-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors disabled:opacity-60"
        />
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          disabled={!canEdit}
          className="h-9 px-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors disabled:opacity-60"
        >
          <option value="">— No category —</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          disabled={!canEdit}
          className="h-9 px-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors disabled:opacity-60"
        />
        <div className="flex gap-2">
          <input
            type="time"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            disabled={!canEdit}
            placeholder="Start"
            className="flex-1 h-9 px-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors disabled:opacity-60"
          />
          <input
            type="time"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            disabled={!canEdit}
            placeholder="End"
            className="flex-1 h-9 px-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors disabled:opacity-60"
          />
        </div>
        <input
          type="text"
          value={entryInfo}
          onChange={e => setEntryInfo(e.target.value)}
          placeholder='Entry (e.g. "Free", "Pay what you want", "8 €")'
          disabled={!canEdit}
          className="h-9 px-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors disabled:opacity-60"
        />
        <select
          value={language}
          onChange={e => setLanguage(e.target.value)}
          disabled={!canEdit}
          className="h-9 px-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors disabled:opacity-60"
        >
          <option value="">— No language —</option>
          {LANGUAGES.map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description"
        rows={2}
        disabled={!canEdit}
        className="w-full px-2 py-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors disabled:opacity-60 resize-y"
      />

      {isPending && confirmingClash && (
        <div className="border border-yellow-500/50 bg-yellow-500/10 rounded-sm p-3 space-y-2">
          <p className="text-xs font-medium text-yellow-700">
            ⚠ {sameDayEvents.length === 1
              ? "There is already an event that day:"
              : `There are already ${sameDayEvents.length} events that day:`}
          </p>
          <ul className="space-y-1">
            {sameDayEvents.map(e => (
              <li key={e.id}>
                <a
                  href={`/event/${e.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {e.title}{e.startTime ? ` · ${e.startTime}` : ""}
                </a>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Open the link(s) to compare. If this is a duplicate, cancel and reject.
          </p>
        </div>
      )}

      {isPending && (
        <div className="flex justify-end gap-2 flex-shrink-0">
          {confirmingClash ? (
            <>
              <button
                onClick={() => setConfirmingClash(false)}
                disabled={submitting}
                className="inline-flex items-center gap-1 h-8 px-3 border border-border rounded-sm text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={performApprove}
                disabled={submitting}
                className="inline-flex items-center gap-1 h-8 px-3 bg-yellow-600 text-white rounded-sm text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="h-3 w-3" /> {submitting ? "Approving…" : "Approve anyway"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onReject}
                disabled={submitting}
                className="inline-flex items-center gap-1 h-8 px-3 border border-border rounded-sm text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                <X className="h-3 w-3" /> Reject
              </button>
              <button
                onClick={handleApprove}
                disabled={submitting}
                className="inline-flex items-center gap-1 h-8 px-3 bg-foreground text-background rounded-sm text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="h-3 w-3" /> {submitting ? "Approving…" : "Approve"}
              </button>
            </>
          )}
        </div>
      )}

      {isApproved && canEdit && isDirty && (
        <div className="flex justify-end gap-2 flex-shrink-0">
          <button
            onClick={handleSaveApprovedClick}
            disabled={submitting}
            className="inline-flex items-center gap-1 h-8 px-3 bg-foreground text-background rounded-sm text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="h-3 w-3" /> {submitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}

function StagedEventPreview({ staged }: { staged: StagedEvent }) {
  const displayTitle = cleanEventTitle(staged.title || "(untitled)", staged.venueName);
  const detailsLine = [staged.entryInfo, staged.language ? `in ${staged.language}` : ""]
    .filter(Boolean)
    .join(" · ");
  const handleMaps = () => {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(staged.venueAddress || staged.venueName)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className="border border-border rounded-sm overflow-hidden bg-background">
      <div className="px-3 py-1.5 bg-muted/60 border-b border-border text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        Live preview
      </div>
      <div className="relative h-[120px] bg-muted overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      </div>
      <div className="px-4 pt-3 pb-1">
        <h3 className="font-body text-lg font-extrabold leading-[1.1] tracking-tight">{displayTitle}</h3>
      </div>
      <div className="px-4 pb-3 pt-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled
            className="h-10 px-5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider font-body rounded-full border-2 bg-transparent text-foreground border-accent opacity-90 cursor-default"
          >
            <Plus className="h-4 w-4" /> Interested
          </button>
          <span className="inline-flex items-center gap-1 text-xs text-accent font-mono">
            <Users className="h-4 w-4" /> 0
          </span>
        </div>
      </div>
      <div className="border-t border-border mx-4" />
      <div className="px-4 pt-3 pb-3 flex items-start gap-4">
        <div className="flex-1 min-w-0">
          {staged.date ? (
            <p className="font-body font-bold text-sm">{formatDateWithDay(staged.date)}</p>
          ) : (
            <p className="font-body font-bold text-sm text-muted-foreground italic">(no date)</p>
          )}
          {staged.startTime && (
            <p className="text-foreground font-mono text-sm mt-0.5">
              {staged.startTime}{staged.endTime ? ` – ${staged.endTime}` : ""}
              {endsNextDay(staged.startTime ?? undefined, staged.endTime ?? undefined) && (
                <span className="text-muted-foreground text-xs ml-1">(next day)</span>
              )}
            </p>
          )}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="font-body font-bold text-sm truncate">{staged.venueName}</p>
          {staged.venueAddress && (
            <p className="text-muted-foreground text-[13px] mt-0.5">
              {staged.venueAddress.replace(/,\s*(Germany|Deutschland)\s*$/i, "")}
            </p>
          )}
          <p className="text-muted-foreground text-[13px] mt-0.5 flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" /> {staged.venueNeighborhood}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs font-mono text-accent">
            <button onClick={handleMaps} className="cursor-pointer hover:underline">
              Open in Maps
            </button>
          </div>
        </div>
      </div>
      <div className="border-t border-border mx-4" />
      <div className="px-4 py-4 space-y-3">
        <h4 className="font-body text-xs font-bold uppercase tracking-[0.12em]">About this event</h4>
        {detailsLine && <p className="text-xs text-muted-foreground">{detailsLine}</p>}
        {staged.description ? (
          staged.description.split("\n\n").map((p, i) => (
            <p key={i} className="text-sm text-muted-foreground/80 leading-[1.7] font-body">{p}</p>
          ))
        ) : (
          <p className="text-xs italic text-muted-foreground/70">(no description)</p>
        )}
      </div>
      {staged.sourceUrl && (
        <a
          href={staged.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between mx-4 py-3 border-t border-border text-sm text-foreground hover:text-accent transition-colors"
        >
          <span className="font-medium">Event link</span>
          <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
        </a>
      )}
    </div>
  );
}

function StagedEventsList({
  events,
  loading,
  filter,
  onFilterChange,
  query,
  onQueryChange,
  showCreatedManuallyPill,
  hideManualBadge,
  onCreateBlank,
  liveEventsByVenue,
  venues,
  onApprove,
  onReject,
  onDuplicate,
  onVenueChange,
  onSourceUrlChange,
  onSaveApproved,
  emptyLabel,
}: {
  events: StagedEvent[];
  loading: boolean;
  filter: ScrapedTabFilter;
  onFilterChange: (f: ScrapedTabFilter) => void;
  query: string;
  onQueryChange: (q: string) => void;
  showCreatedManuallyPill: boolean;
  hideManualBadge: boolean;
  onCreateBlank?: () => void;
  liveEventsByVenue: Record<string, LiveEventInfo[]>;
  venues: Venue[];
  onApprove: (s: StagedEvent, edits: StagedEventEdits) => Promise<void>;
  onReject: (s: StagedEvent) => Promise<void>;
  onDuplicate: (s: StagedEvent, edits: StagedEventEdits) => Promise<void>;
  onVenueChange: (id: string, venueId: string) => Promise<void>;
  onSourceUrlChange: (id: string, url: string) => Promise<void>;
  onSaveApproved: (s: StagedEvent, edits: StagedEventEdits) => Promise<void>;
  emptyLabel: string;
}) {
  const statusPills: ScrapedTabFilter[] = ["pending", "rejected", "approved", "all"];
  const pills: ScrapedTabFilter[] = showCreatedManuallyPill
    ? [...statusPills, "manual"]
    : statusPills;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 mb-2">
        <div className="flex gap-2 flex-shrink-0 flex-wrap">
          {pills.map(f => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`h-10 px-3 text-xs font-medium border rounded-sm transition-colors ${
                filter === f
                  ? "bg-foreground text-background border-foreground"
                  : "border-border hover:bg-muted"
              }`}
            >
              {f === "manual" ? "Created Manually" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          {onCreateBlank && (
            <button
              onClick={onCreateBlank}
              disabled={venues.length === 0}
              className="inline-flex items-center gap-1 h-10 px-3 text-xs font-medium border border-border rounded-sm hover:bg-muted disabled:opacity-50"
              title="Create new manual card"
            >
              <Plus className="h-4 w-4" /> New
            </button>
          )}
        </div>
        <input
          type="search"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="Search by venue or title…"
          className="flex-1 h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
        />
      </div>
      {loading && <div className="flex justify-center py-4"><Spinner /></div>}
      {!loading && events.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No {filter === "manual" ? "manual" : filter === "all" ? "" : filter} {emptyLabel} events.
        </p>
      )}
      {!loading && (() => {
        const q = query.trim().toLowerCase();
        const filtered = q
          ? events.filter(s =>
              s.venueName.toLowerCase().includes(q) ||
              s.title.toLowerCase().includes(q),
            )
          : events;
        if (q && filtered.length === 0) {
          return <p className="text-sm text-muted-foreground">No events match your search.</p>;
        }
        return filtered.map(staged => {
          const card = (
            <StagedEventCard
              staged={staged}
              liveEvents={liveEventsByVenue[staged.venueId] ?? []}
              venues={venues}
              hideManualBadge={hideManualBadge}
              onApprove={(edits) => onApprove(staged, edits)}
              onReject={() => onReject(staged)}
              onDuplicate={(edits) => onDuplicate(staged, edits)}
              onVenueChange={(venueId) => onVenueChange(staged.id, venueId)}
              onSourceUrlChange={(url) => onSourceUrlChange(staged.id, url)}
              onSaveApproved={(edits) => onSaveApproved(staged, edits)}
            />
          );
          if (filter === "approved") {
            return (
              <div key={staged.id} className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                {card}
                <StagedEventPreview staged={staged} />
              </div>
            );
          }
          return <div key={staged.id}>{card}</div>;
        });
      })()}
    </div>
  );
}
