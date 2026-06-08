import { useState, useEffect, useCallback, useMemo, useRef, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, addMonths, differenceInDays, format, parse } from "date-fns";
import { generateOccurrences, formatRecurrenceLabel, describeRule, parseRule, type RecurrenceFreq } from "@/lib/recurrence";
import { formatDateShort, formatDateWithDay, formatTimestampAsBerlinDate } from "@/lib/dateFormat";
import { isEventInPast } from "@/lib/eventStatus";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, X, Building2, Shield, Globe, Instagram, Phone, Edit, CalendarDays, ExternalLink, Plus, Copy, Repeat, ChevronDown, Eye, Trash2, Ban } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/spinner";
import { PageSpinner } from "@/components/ui/page-spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories } from "@/hooks/useEvents";
import { berlinDateString, berlinDateStringOffset } from "@/lib/dateFormat";
import { LANGUAGES } from "@/data/languages";
import { CUSTOM_ENTRY_SENTINEL, ENTRY_AMOUNTS, PREDEFINED_ENTRY_OPTIONS } from "@/data/entryOptions";
import {
  fetchPendingOrganizers,
  fetchDecidedOrganizers,
  fetchVenuesWithOwnership,
  updateOrganizerApprovalStatus,
  approveOrganizerWithNewBar,
  approveOrganizerWithVenueClaim,
  setVenueScrapeEnabled,
  setVenueInstagramScrapeEnabled,
  setVenueVisible,
  updateVenueLinks,
  fetchStagedEvents,
  fetchApprovedEvents,
  approveStagedEvent,
  autoApproveScrapedEvents,
  rejectStagedEvent,
  moveStagedEventToRecurring,
  deleteStagedEvent,
  fetchLiveEventsByVenue,
  fetchVenues,
  createBlankManualStagedEvent,
  duplicateStagedEvent,
  updateStagedEventManualFields,
  uploadEventImage,
  updateApprovedEvent,
  updateApprovedEventImage,
  deleteApprovedEvent,
  cancelEvent,
  fetchEventsByCreator,
  fetchEventById,
  fetchPendingUserSubmissions,
  fetchApprovedUserEvents,
  fetchPendingUserSubmissionCount,
  createVenueForStagedSubmission,
  type OrganizerAccount,
  type LiveEventInfo,
  type ApprovedEventListItem,
  type SubmissionVenueData,
} from "@/lib/supabaseQueries";
import type { BarlinEvent, StagedEvent, StagedEventEdits, StagedEventStatusFilter, Venue } from "@/types/event";
import EventDiffModal from "@/components/admin/EventDiffModal";

// Approved events live in the `events` table. To keep the existing card UI
// working, adapt them to the StagedEvent shape used by StagedEventCard.
// `status: "approved"` is the virtual marker — staging never stores that.
// siblings come from fetchApprovedEvents (sibling rows in `events`); they
// can't be derived from the row alone because recurrence_until isn't stored
// post-approval.
function approvedItemToAdminStaged(item: ApprovedEventListItem): StagedEvent {
  const { event, siblings } = item;
  // The parent row stores the rule as a single string ("freq;until=date").
  // The editor expects freq and until split apart, so parse them back out —
  // otherwise the <select> can't match an option and describeRule mislabels.
  const parsedRule = parseRule(event.recurrence);
  return {
    id: event.id,
    parentId: event.parentId,
    venueId: event.venueId,
    venueName: event.venue,
    venueAddress: event.address,
    venueNeighborhood: event.neighborhood,
    title: event.title,
    date: event.date,
    startTime: event.startTime || null,
    endTime: event.endTime ?? null,
    doorsTime: event.doorsTime ?? null,
    category: event.category,
    language: event.language,
    description: event.description,
    entryInfo: event.entryInfo,
    sourceUrl: event.url || null,
    status: "approved",
    scrapedAt: "",
    isManual: event.isManual,
    createdByAdmin: false,
    recurrence: parsedRule?.freq ?? "",
    recurrenceUntil: parsedRule?.until ?? null,
    replacesEventId: null,
    createdBy: event.createdBy ?? null,
    image: event.image ?? null,
    imagePosition: event.imagePosition,
    submitter: event.submitter,
    interestedCount: event.interestedCount,
    approvedSiblings: siblings,
  };
}

type BarTab = "pending" | "overview" | "all-bars" | "user" | "scraped" | "manual" | "recurring";
type AdminSection = "bars" | "events";

const BAR_TABS: BarTab[] = ["pending", "overview", "all-bars"];
const EVENT_TABS: BarTab[] = ["user", "scraped", "manual", "recurring"];

const sectionOf = (tab: BarTab): AdminSection =>
  tab === "user" || tab === "scraped" || tab === "manual" || tab === "recurring" ? "events" : "bars";

const defaultTabFor = (section: AdminSection): BarTab =>
  section === "events" ? "user" : "pending";

function openSourceWindow(url: string) {
  // Protocol-less URLs ("example.com/events") would be treated as relative
  // by the browser and 404 on our domain. Force https:// when missing.
  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;

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

  // Safari notes:
  //  - Named targets ("verify-source") + feature string trigger the popup
  //    blocker silently. _blank works.
  //  - `popup=true` and `noopener,noreferrer` *inside* the feature string
  //    confuse Safari's parser; some versions reject the whole feature list.
  //    Specify only width/height/left/top here, and detach `opener` after.
  //  - Only width+height present makes Safari open it as a sized popup window
  //    rather than a tab.
  const features = `width=${popupW},height=${popupH},left=${popupLeft},top=${popupTop}`;
  const popup = window.open(normalized, "_blank", features);

  if (popup) {
    // After-open positioning: Safari occasionally ignores left/top in the
    // feature string and centers the popup. Re-issuing moveTo/resizeTo from
    // JS forces the placement.
    try {
      popup.moveTo(popupLeft, popupTop);
      popup.resizeTo(popupW, popupH);
    } catch {
      /* cross-origin once navigated — ignore */
    }
    // noopener equivalent without polluting the feature string.
    popup.opener = null;
  } else {
    // Popup blocker bit. Last-resort: open in a regular new tab so the user
    // at least lands on the page.
    window.open(normalized, "_blank");
  }
}

export default function AdminDashboard() {
  const { user, role, loading, roleResolved } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeBarTab: BarTab =
    tabParam === "overview" ? "overview"
    : tabParam === "all-bars" ? "all-bars"
    : tabParam === "user" ? "user"
    : tabParam === "scraped" ? "scraped"
    : tabParam === "manual" ? "manual"
    : tabParam === "recurring" ? "recurring"
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
  const [allBarsScrapeFilter, setAllBarsScrapeFilter] = useState<"all" | "yes" | "no">("all");
  const [allBarsIgScrapeFilter, setAllBarsIgScrapeFilter] = useState<"all" | "yes" | "no">("all");
  const [allBarsClaimFilter, setAllBarsClaimFilter] = useState<"all" | "claimed" | "unclaimed">("all");
  const [scrapedEvents, setScrapedEvents] = useState<StagedEvent[]>([]);
  const [scrapedLoading, setScrapedLoading] = useState(true);
  const [scrapedFilter, setScrapedFilter] = useState<StagedEventStatusFilter>("pending");
  const [scrapedQuery, setScrapedQuery] = useState("");
  const [manualEvents, setManualEvents] = useState<StagedEvent[]>([]);
  const [manualLoading, setManualLoading] = useState(true);
  const [manualFilter, setManualFilter] = useState<StagedEventStatusFilter>("pending");
  const [manualQuery, setManualQuery] = useState("");
  const [recurringEvents, setRecurringEvents] = useState<StagedEvent[]>([]);
  const [recurringLoading, setRecurringLoading] = useState(true);
  const [recurringFilter, setRecurringFilter] = useState<StagedEventStatusFilter>(
    // Read once at mount so back-navigation from EditEvent (?filter=approved)
    // lands on the right view. Subsequent changes stay component-local.
    () => (searchParams.get("filter") === "approved" ? "approved" : "pending"),
  );
  const [recurringQuery, setRecurringQuery] = useState("");
  const [liveEventsByVenue, setLiveEventsByVenue] = useState<Record<string, LiveEventInfo[]>>({});
  // Plain-user submissions — staged in venue_events_staging (created_by set),
  // rendered with the same StagedEventCard/StagedEventsList as scraped events.
  // The pending filter reads staging rows; approved reads `events` (creator
  // role 'user'), adapted to StagedEvent like the scraped/manual/recurring tabs.
  const [userEvents, setUserEvents] = useState<StagedEvent[]>([]);
  const [userLoading, setUserLoading] = useState(true);
  const [userFilter, setUserFilter] = useState<StagedEventStatusFilter>(
    () => (searchParams.get("filter") === "approved" ? "approved" : "pending"),
  );
  const [userQuery, setUserQuery] = useState("");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [userPendingCount, setUserPendingCount] = useState<number | null>(null);

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

  // Loaders take a { silent } option: silent=true skips toggling the loading
  // state, so a background refresh (e.g. realtime-triggered reload after a
  // duplicate or a scrape insert) doesn't unmount the cards and reset scroll.
  // Approved-filter reads from `events` (single source of truth post-approval);
  // pending/rejected/all stay on `venue_events_staging`. Adapter converts the
  // BarlinEvent shape so the existing StagedEventCard UI works unchanged.
  const loadScrapedEvents = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setScrapedLoading(true);
    try {
      if (scrapedFilter === "approved") {
        const items = await fetchApprovedEvents("scraped");
        setScrapedEvents(items.map(approvedItemToAdminStaged));
      } else {
        setScrapedEvents(await fetchStagedEvents("scraped"));
      }
    } catch {
      toast.error("Failed to load scraped events.");
    } finally {
      if (!silent) setScrapedLoading(false);
    }
  }, [scrapedFilter]);

  const loadManualEvents = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setManualLoading(true);
    try {
      if (manualFilter === "approved") {
        const items = await fetchApprovedEvents("manual");
        setManualEvents(items.map(approvedItemToAdminStaged));
      } else {
        setManualEvents(await fetchStagedEvents("manual"));
      }
    } catch {
      toast.error("Failed to load manual events.");
    } finally {
      if (!silent) setManualLoading(false);
    }
  }, [manualFilter]);

  const loadRecurringEvents = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setRecurringLoading(true);
    try {
      if (recurringFilter === "approved") {
        const items = await fetchApprovedEvents("recurring");
        setRecurringEvents(items.map(approvedItemToAdminStaged));
      } else {
        setRecurringEvents(await fetchStagedEvents("recurring"));
      }
    } catch {
      toast.error("Failed to load recurring events.");
    } finally {
      if (!silent) setRecurringLoading(false);
    }
  }, [recurringFilter]);

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

  // User-events tab: pending reads staging rows; approved reads `events`
  // (creator role 'user') adapted to the StagedEvent shape — same split the
  // scraped/manual/recurring loaders use. silent skips the loading flag so a
  // realtime refresh doesn't unmount cards.
  const loadUserEvents = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setUserLoading(true);
    try {
      if (userFilter === "approved") {
        const items = await fetchApprovedUserEvents();
        setUserEvents(items.map(approvedItemToAdminStaged));
      } else {
        setUserEvents(await fetchPendingUserSubmissions());
      }
    } catch {
      toast.error("Failed to load user events.");
    } finally {
      if (!silent) setUserLoading(false);
    }
  }, [userFilter]);

  const loadPendingEventCounts = useCallback(async () => {
    try {
      setUserPendingCount(await fetchPendingUserSubmissionCount());
    } catch {
      // Silent — count is informational, not critical.
    }
  }, []);

  useEffect(() => {
    loadPendingOrganizers();
    loadDecidedOrganizers();
    loadAllBars();
    loadVenues();
    loadPendingEventCounts();
  }, [loadPendingOrganizers, loadDecidedOrganizers, loadAllBars, loadVenues, loadPendingEventCounts]);

  useEffect(() => {
    loadUserEvents();
  }, [loadUserEvents]);

  useEffect(() => {
    loadScrapedEvents();
  }, [loadScrapedEvents]);

  useEffect(() => {
    loadManualEvents();
  }, [loadManualEvents]);

  useEffect(() => {
    loadRecurringEvents();
  }, [loadRecurringEvents]);

  useEffect(() => {
    loadLiveEvents();
  }, [loadLiveEvents]);

  // Realtime: when the Python scraper (or any source) writes to
  // venue_events_staging, refresh the affected lists + counts without a reload.
  // Debounced 500ms so a scrape burst (~40 inserts in 1-2s) collapses into one
  // fetch round instead of 40.
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const channel = supabase
      .channel("admin-staging")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "venue_events_staging" },
        () => {
          if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
          reloadTimerRef.current = setTimeout(() => {
            // silent: true so the lists refresh in-place without flipping
            // loading=true (which would unmount cards and lose scroll).
            loadScrapedEvents({ silent: true });
            loadManualEvents({ silent: true });
            loadRecurringEvents({ silent: true });
            loadPendingEventCounts();
            // User submissions live in this table too — refresh the User
            // events list (pending filter) when one lands.
            loadUserEvents({ silent: true });
          }, 500);
        },
      )
      .subscribe();
    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [loadScrapedEvents, loadManualEvents, loadRecurringEvents, loadPendingEventCounts, loadUserEvents]);

  const handleApproveOrganizer = async (organizer: OrganizerAccount) => {
    if (!user) return;
    if (organizer.orphaned) {
      toast.error("Can't approve — venue was deleted. Please reject this organizer.");
      return;
    }
    if (organizer.pendingClaim && organizer.pendingClaim.existingOwners.length > 0) {
      const ownerList = organizer.pendingClaim.existingOwners.map((o) => o.name).join(", ");
      const ok = window.confirm(
        `This bar already has ${organizer.pendingClaim.existingOwners.length} owner(s): ${ownerList}.\n\nReally add another owner?`,
      );
      if (!ok) return;
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
        const result = await approveOrganizerWithNewBar(organizer.id, user.id);
        approvedVenue = {
          id: result.venueId,
          name: organizer.pendingSubmission.name,
          address: organizer.pendingSubmission.address,
          neighborhood: organizer.pendingSubmission.neighborhood,
          website: organizer.pendingSubmission.website,
          instagram: organizer.pendingSubmission.instagram,
          phone: organizer.pendingSubmission.phone,
          image: null,
          image_position: "50% 50%",
          lat: result.lat,
          lng: result.lng,
        };
        loadAllBars();
      } else if (organizer.pendingClaim && !organizer.venue) {
        await approveOrganizerWithVenueClaim(organizer.id, user.id);
        // Real coords stay in the DB; lat/lng below are placeholders only —
        // the decided list shows name/address, EditBarAccount re-fetches.
        approvedVenue = {
          id: organizer.pendingClaim.venueId,
          name: organizer.pendingClaim.venueName,
          address: organizer.pendingClaim.venueAddress,
          neighborhood: organizer.pendingClaim.venueNeighborhood,
          website: organizer.pendingClaim.proposedWebsite ?? organizer.pendingClaim.venueWebsite,
          instagram: organizer.pendingClaim.proposedInstagram ?? organizer.pendingClaim.venueInstagram,
          phone: organizer.pendingClaim.proposedPhone ?? organizer.pendingClaim.venuePhone,
          image: null,
          image_position: "50% 50%",
          lat: 0,
          lng: 0,
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to approve bar account.";
      toast.error(msg, { duration: 8000 });
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

  // Inline editor on event cards (scraped/manual/recurring) updates
  // venues.website_events for the row's bar. Mirrors the optimistic
  // update pattern of handleVenueLinkChange and additionally syncs the
  // `venues` array so the StagedEventCard editor reseeds correctly when
  // another event of the same bar is opened.
  const handleVenueWebsiteEventsChange = async (venueId: string, value: string | null) => {
    const next = value && value.trim() ? value.trim() : null;
    setAllBars(prev =>
      prev.map(item =>
        item.venue.id === venueId
          ? { ...item, venue: { ...item.venue, websiteEvents: next ?? undefined } }
          : item,
      ),
    );
    setVenues(prev =>
      prev.map(v => (v.id === venueId ? { ...v, websiteEvents: next ?? undefined } : v)),
    );
    try {
      await updateVenueLinks(venueId, { websiteEvents: next });
      toast.success(next ? "Events page URL updated." : "Events page URL cleared.");
    } catch {
      toast.error("Failed to update events page URL.");
      loadAllBars();
      loadVenues();
    }
  };

  const handleVenueInstagramChange = async (venueId: string, value: string | null) => {
    const next = value && value.trim() ? value.trim() : null;
    setAllBars(prev =>
      prev.map(item =>
        item.venue.id === venueId
          ? { ...item, venue: { ...item.venue, instagram: next ?? undefined } }
          : item,
      ),
    );
    setVenues(prev =>
      prev.map(v => (v.id === venueId ? { ...v, instagram: next ?? undefined } : v)),
    );
    try {
      await updateVenueLinks(venueId, { instagram: next });
      toast.success(next ? "Instagram updated." : "Instagram cleared.");
    } catch {
      toast.error("Failed to update Instagram.");
      loadAllBars();
      loadVenues();
    }
  };

  const handleToggleScrapeEnabled = async (venueId: string, next: boolean) => {
    setAllBars(prev =>
      prev.map(item =>
        item.venue.id === venueId ? { ...item, venue: { ...item.venue, scrapeEnabled: next } } : item,
      ),
    );
    try {
      await setVenueScrapeEnabled(venueId, next);
    } catch {
      setAllBars(prev =>
        prev.map(item =>
          item.venue.id === venueId
            ? { ...item, venue: { ...item.venue, scrapeEnabled: !next } }
            : item,
        ),
      );
      toast.error("Couldn't update scraping status. Please try again.");
    }
  };

  const handleToggleInstagramScrapeEnabled = async (venueId: string, next: boolean) => {
    setAllBars(prev =>
      prev.map(item =>
        item.venue.id === venueId
          ? { ...item, venue: { ...item.venue, instagramScrapeEnabled: next } }
          : item,
      ),
    );
    try {
      await setVenueInstagramScrapeEnabled(venueId, next);
    } catch {
      setAllBars(prev =>
        prev.map(item =>
          item.venue.id === venueId
            ? { ...item, venue: { ...item.venue, instagramScrapeEnabled: !next } }
            : item,
        ),
      );
      toast.error("Couldn't update Instagram scraping status. Please try again.");
    }
  };

  const handleToggleVisible = async (venueId: string, next: boolean) => {
    setAllBars(prev =>
      prev.map(item =>
        item.venue.id === venueId ? { ...item, venue: { ...item.venue, isVisible: next } } : item,
      ),
    );
    try {
      await setVenueVisible(venueId, next);
    } catch {
      setAllBars(prev =>
        prev.map(item =>
          item.venue.id === venueId
            ? { ...item, venue: { ...item.venue, isVisible: !next } }
            : item,
        ),
      );
      toast.error("Couldn't update visibility. Please try again.");
    }
  };

  const handleApproveStaged = async (staged: StagedEvent, edits: StagedEventEdits) => {
    if (!user) return;
    try {
      await approveStagedEvent(staged, user.id, edits);
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success(`"${edits.title ?? staged.title}" approved`);
      setScrapedEvents(prev => prev.filter(s => s.id !== staged.id));
      setManualEvents(prev => prev.filter(s => s.id !== staged.id));
      setRecurringEvents(prev => prev.filter(s => s.id !== staged.id));
      setUserEvents(prev => prev.filter(s => s.id !== staged.id));
      loadPendingEventCounts();
      loadLiveEvents();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to approve event.";
      toast.error(message);
    }
  };

  // Bulk auto-approve for the Scraped tab. Two kinds of rows are handled:
  //   • Update rows (replacesEventId set) patch their diverging fields onto the
  //     existing live event — they share that event's day by definition, so the
  //     same-bar/same-day clash check is skipped for them.
  //   • New rows are inserted only when their bar has no other event that day;
  //     any clash leaves the row in staging for manual review — never overwritten.
  // Operates on currently-pending scraped rows only.
  const handleAutoApproveScraped = async () => {
    if (!user) return;
    // Update rows don't need a venue (they patch an existing event); new rows do.
    const pending = scrapedEvents.filter(
      s => s.status === "pending" && (s.venueId || s.replacesEventId),
    );
    if (pending.length === 0) {
      toast.error("No pending scraped events to approve.");
      return;
    }
    // Quick preview from cached live events (the function recomputes a fresh
    // map for the actual writes). Updates are previewed by count only.
    const updates = pending.filter(s => s.replacesEventId);
    const newRows = pending.filter(s => !s.replacesEventId);
    let clashes = 0;
    for (const s of newRows) {
      if ((liveEventsByVenue[s.venueId] ?? []).some(e => e.date === s.date)) clashes++;
    }
    const willApprove = newRows.length - clashes;
    if (!window.confirm(
      `Auto-approve ${willApprove} new scraped event${willApprove === 1 ? "" : "s"}`
      + (updates.length > 0 ? ` and apply ${updates.length} update${updates.length === 1 ? "" : "s"} to existing events` : "")
      + `? ${clashes} clash with an existing event (same bar, same day) and will be skipped.`,
    )) return;

    try {
      const res = await autoApproveScrapedEvents(pending, user.id);
      queryClient.invalidateQueries({ queryKey: ["events"] });
      const parts = [`${res.approved} new event${res.approved === 1 ? "" : "s"} approved`];
      if (res.updated > 0) parts.push(`${res.updated} update${res.updated === 1 ? "" : "s"} applied`);
      toast.success(parts.join(", "));
      if (res.skipped.length > 0) {
        toast(`${res.skipped.length} skipped (clash or incomplete) — review manually`);
      }
      loadScrapedEvents({ silent: true });
      loadLiveEvents();
      loadPendingEventCounts();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Auto-approve failed.";
      toast.error(message);
    }
  };

  const handleRejectStaged = async (staged: StagedEvent) => {
    if (!user) return;
    try {
      await rejectStagedEvent(staged.id);
      toast.error(`"${staged.title}" rejected`);
      setScrapedEvents(prev => prev.filter(s => s.id !== staged.id));
      setManualEvents(prev => prev.filter(s => s.id !== staged.id));
      setRecurringEvents(prev => prev.filter(s => s.id !== staged.id));
      setUserEvents(prev => prev.filter(s => s.id !== staged.id));
      loadPendingEventCounts();
    } catch {
      toast.error("Failed to reject event.");
    }
  };

  // User-events tab: turn a typed-venue submission into a real bar and link it
  // to the staging row (no approve yet — the admin reviews, then approves like
  // any staged card). Refreshes venues (/bars + picker) and the user list.
  const handleCreateVenueForSubmission = async (staged: StagedEvent, submission: SubmissionVenueData) => {
    if (!submission.name.trim() || !submission.address.trim()) {
      toast.error("Bar name and address are required.");
      return;
    }
    try {
      await createVenueForStagedSubmission(staged.id, {
        name: submission.name.trim(),
        address: submission.address.trim(),
        neighborhood: submission.neighborhood,
      });
      toast.success(`Bar "${submission.name.trim()}" created and linked`);
      queryClient.invalidateQueries({ queryKey: ["venues"] });
      loadVenues();
      loadUserEvents({ silent: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create the bar. Please try again.");
    }
  };

  // Reclassify a scraped staging row as recurring. Optimistically remove from
  // scraped list, then DB update — the realtime listener on
  // venue_events_staging will surface the row in the Recurring tab on the
  // next reload tick. We also refetch counts immediately for the tab badges.
  const handleMoveScrapedToRecurring = async (staged: StagedEvent) => {
    setScrapedEvents(prev => prev.filter(s => s.id !== staged.id));
    try {
      await moveStagedEventToRecurring(staged.id);
      toast.success(`"${staged.title}" moved to Recurring.`);
      loadRecurringEvents({ silent: true });
      loadPendingEventCounts();
    } catch {
      toast.error("Failed to move event to Recurring.");
      loadScrapedEvents();
    }
  };

  const handleMoveManualToRecurring = async (staged: StagedEvent) => {
    setManualEvents(prev => prev.filter(s => s.id !== staged.id));
    try {
      await moveStagedEventToRecurring(staged.id);
      toast.success(`"${staged.title}" moved to Recurring.`);
      loadRecurringEvents({ silent: true });
      loadPendingEventCounts();
    } catch {
      toast.error("Failed to move event to Recurring.");
      loadManualEvents();
    }
  };

  const handleCancelStaged = async (staged: StagedEvent) => {
    try {
      await deleteStagedEvent(staged.id);
      toast.success("Card discarded");
      setManualEvents(prev => prev.filter(s => s.id !== staged.id));
      setRecurringEvents(prev => prev.filter(s => s.id !== staged.id));
      loadPendingEventCounts();
    } catch {
      toast.error("Failed to discard card.");
    }
  };

  const handleCreateBlank = async (scope: "scraped" | "manual" | "recurring") => {
    if (venues.length === 0) {
      toast.error("No venues available.");
      return;
    }
    try {
      const defaultVenue = venues[0];
      const created = await createBlankManualStagedEvent(
        defaultVenue.id,
        scope,
        defaultVenue.websiteEvents ?? null,
      );
      if (scope === "manual") {
        setManualFilter("pending");
        setManualEvents(prev => [created, ...prev.filter(s => s.id !== created.id)]);
      } else if (scope === "recurring") {
        setRecurringFilter("pending");
        setRecurringEvents(prev => [created, ...prev.filter(s => s.id !== created.id)]);
      } else {
        if (scrapedFilter !== "pending") setScrapedFilter("pending");
        setScrapedEvents(prev => [created, ...prev.filter(s => s.id !== created.id)]);
      }
      toast.success("Blank card created");
      loadPendingEventCounts();
    } catch {
      toast.error("Failed to create card.");
    }
  };

  const handleDuplicateStaged = async (
    source: StagedEvent,
    edits: StagedEventEdits,
    scope: "scraped" | "manual" | "recurring",
  ) => {
    try {
      const created = await duplicateStagedEvent(source, edits, scope);
      const insertAfterSource = (prev: StagedEvent[]) => {
        const idx = prev.findIndex(s => s.id === source.id);
        if (idx === -1) return [created, ...prev];
        return [...prev.slice(0, idx + 1), created, ...prev.slice(idx + 1)];
      };
      if (scope === "recurring") {
        setRecurringEvents(insertAfterSource);
      } else if (scope === "manual") {
        setManualEvents(insertAfterSource);
      } else {
        setScrapedEvents(insertAfterSource);
      }
      toast.success("Card duplicated");
      loadPendingEventCounts();
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
      setRecurringEvents(apply);
      setUserEvents(apply);
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
      setRecurringEvents(apply);
      setUserEvents(apply);
    } catch {
      toast.error("Failed to update URL.");
    }
  };

  // Replace (file) or remove (null) a staging row's cover image. Replace uploads
  // to the event-images bucket under the admin's id, then persists the URL;
  // remove just clears the column. The image carries into events.image on
  // approve, so editing it here is the pre-approval QA step.
  const handleManualImageChange = async (stagedId: string, file: File | null) => {
    try {
      let image: string | null = null;
      let imagePosition: string | undefined;
      if (file) {
        image = await uploadEventImage(file, user.id);
        imagePosition = "50% 50%";
      }
      await updateStagedEventManualFields(stagedId, { image, imagePosition });
      const apply = (prev: StagedEvent[]) =>
        prev.map(s =>
          s.id === stagedId
            ? { ...s, image, ...(imagePosition ? { imagePosition } : {}) }
            : s,
        );
      setScrapedEvents(apply);
      setManualEvents(apply);
      setRecurringEvents(apply);
      setUserEvents(apply);
      toast.success(file ? "Image updated" : "Image removed");
    } catch {
      toast.error("Failed to update image.");
    }
  };

  // Approved cards wrap a live `events` row (not a staging row), so their cover
  // is written straight to `events`. For a series we cascade to the root + all
  // children so every date shares one image; replace overwrites, null clears.
  const handleApprovedSeriesImageChange = async (staged: StagedEvent, file: File | null) => {
    const seriesId = staged.parentId || (staged.recurrence ? staged.id : null);
    try {
      let image: string | null = null;
      if (file) image = await uploadEventImage(file, user.id);
      await updateApprovedEventImage(staged.id, seriesId, image);
      const apply = (prev: StagedEvent[]) =>
        prev.map(s =>
          s.id === staged.id
            ? { ...s, image, ...(image ? { imagePosition: "50% 50%" } : {}) }
            : s,
        );
      setRecurringEvents(apply);
      setManualEvents(apply);
      toast.success(file ? "Series image updated" : "Series image removed");
    } catch {
      toast.error("Failed to update the series image.");
    }
  };

  const handleRecurrenceChange = async (
    stagedId: string,
    patch: { recurrence?: string; recurrenceUntil?: string | null },
  ) => {
    try {
      await updateStagedEventManualFields(stagedId, patch);
      // The recurrence editor shows on the Recurring tab and (with allowOneTime)
      // the User events tab, so reflect the change in both lists.
      const apply = (prev: StagedEvent[]) =>
        prev.map(s =>
          s.id === stagedId
            ? {
                ...s,
                recurrence: patch.recurrence !== undefined ? patch.recurrence : s.recurrence,
                recurrenceUntil:
                  patch.recurrenceUntil !== undefined ? patch.recurrenceUntil : s.recurrenceUntil,
              }
            : s,
        );
      setRecurringEvents(apply);
      setUserEvents(apply);
    } catch {
      toast.error("Failed to update recurrence.");
    }
  };

  const handleSaveApprovedStaged = async (staged: StagedEvent, edits: StagedEventEdits) => {
    try {
      // Approved events live in `events`; staged.id IS the displayed event id
      // (set by the adapter). seriesId picks the right scope for shared fields:
      //   • orphan child  → staged.parentId (parent already archived)
      //   • live parent   → staged.id (parent still alive, has recurrence rule)
      //   • singleton     → null
      const seriesId = staged.parentId || (staged.recurrence ? staged.id : null);
      await updateApprovedEvent(staged.id, seriesId, edits);
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["event", staged.id] });
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
      setRecurringEvents(apply);
      setUserEvents(apply);
      loadLiveEvents();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save changes.";
      toast.error(message);
    }
  };

  const handleDeleteApproved = async (staged: StagedEvent) => {
    // seriesId resolution mirrors handleSaveApprovedStaged: orphan child →
    // parentId; live parent → own id; singleton → null. For series we wipe
    // the whole thing, including past occurrences, so the bar's history is
    // cleared too.
    const seriesId = staged.parentId || (staged.recurrence ? staged.id : null);
    const isSeries = seriesId !== null;
    const confirmMsg = isSeries
      ? `Delete "${staged.title}" and ALL occurrences in this series? This removes them from the site for everyone.`
      : `Delete "${staged.title}"? This removes it from the site for everyone.`;
    if (!window.confirm(confirmMsg)) return;
    try {
      await deleteApprovedEvent(staged.id, seriesId);
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["event", staged.id] });
      toast.success(isSeries ? "Series deleted" : "Event deleted");
      setScrapedEvents(prev => prev.filter(s => s.id !== staged.id));
      setManualEvents(prev => prev.filter(s => s.id !== staged.id));
      setRecurringEvents(prev => prev.filter(s => s.id !== staged.id));
      setUserEvents(prev => prev.filter(s => s.id !== staged.id));
      loadLiveEvents();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete event.";
      toast.error(message);
    }
  };

  // Single-row delete used by the All Bars per-bar events list. Always passes
  // seriesId=null so deleting a series child only drops that occurrence — the
  // rest of the series keeps running. The richer handleDeleteApproved (above)
  // is for the staged-card flow where wiping the whole series is the intent.
  const handleDeleteApprovedSingle = async (eventId: string) => {
    if (!window.confirm("Delete this event? Only this occurrence is removed.")) return;
    try {
      await deleteApprovedEvent(eventId, null);
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      toast.success("Event deleted");
      loadLiveEvents();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete event.";
      toast.error(message);
    }
  };

  const handleCancelOccurrence = async (staged: StagedEvent) => {
    // Cancels just this one date of a series. Index.tsx already filters
    // canceled events to only show on today/tomorrow — so distant cancellations
    // are silently hidden, near ones stay visible with a "canceled" badge.
    // The extend_recurring_series cron skips dates that already exist (any
    // status), so canceled rows aren't regenerated.
    const today = berlinDateString();
    const tomorrow = berlinDateStringOffset(1);
    const staysVisible = staged.date === today || staged.date === tomorrow;
    const confirmMsg = staysVisible
      ? `Cancel this occurrence on ${staged.date}? It stays visible on the homepage marked as canceled. The rest of the series continues.`
      : `Skip this occurrence on ${staged.date}? It will be hidden from the homepage. The rest of the series continues.`;
    if (!window.confirm(confirmMsg)) return;
    try {
      await cancelEvent(staged.id, "admin");
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["event", staged.id] });
      toast.success(staysVisible ? "Occurrence canceled" : "Occurrence skipped");
      loadRecurringEvents({ silent: true });
      loadLiveEvents();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to cancel occurrence.";
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
    return <PageSpinner />;
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
                <span className="text-xs text-muted-foreground font-medium">Pending Bar Submissions</span>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
              {pendingOrganizersLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <p className="font-serif text-2xl font-bold">{String(pendingOrganizers.length)}</p>
              )}
            </div>
            <div className="border border-border rounded-sm p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Pending User Events</span>
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </div>
              {userPendingCount === null ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <p className="font-serif text-2xl font-bold">{String(userPendingCount)}</p>
              )}
            </div>
          </div>

          {/* Section toggle: Bars vs Events */}
          <div className="inline-flex border border-border rounded-sm p-0.5 bg-muted/30 mb-4">
            {(["bars", "events"] as const).map(section => {
              const active = sectionOf(activeBarTab) === section;
              return (
                <button
                  key={section}
                  onClick={() => setActiveBarTab(defaultTabFor(section))}
                  className={`px-4 h-8 text-sm font-medium capitalize rounded-sm transition-colors ${
                    active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {section}
                </button>
              );
            })}
          </div>

          {/* Sub-tabs for the active section only */}
          <div className="flex gap-4 border-b border-border mb-6 overflow-x-auto">
            {(sectionOf(activeBarTab) === "bars" ? BAR_TABS : EVENT_TABS).map((tab) => (
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
                  ? decidedOrganizersLoading ? "Approved" : `Approved (${decidedOrganizers.length})`
                  : tab === "all-bars"
                  ? allBarsLoading ? "All Bars" : `All Bars (${allBars.length})`
                  : tab === "scraped"
                  ? scrapedLoading ? "Scraped Events" : `Scraped Events (${scrapedEvents.length})`
                  : tab === "manual"
                  ? manualLoading ? "Manual Events" : `Manual Events (${manualEvents.length})`
                  : tab === "user"
                  ? userPendingCount === null ? "User Events" : `User Events (${userPendingCount})`
                  : recurringLoading ? "Recurring Events" : `Recurring Events (${recurringEvents.length})`}
              </button>
            ))}
          </div>

          {/* User events — plain-user submissions, rendered with the same
              StagedEventCard UI as scraped/recurring. Pending reads staging rows
              (created_by set); Approved reads `events` (creator role 'user').
              Typed-venue rows get the "Create bar & link" affordance in-card. */}
          {activeBarTab === "user" && (
            <StagedEventsList
              events={userEvents}
              loading={userLoading}
              filter={userFilter}
              onFilterChange={setUserFilter}
              query={userQuery}
              onQueryChange={setUserQuery}
              venues={venues}
              scope="user"
              liveEventsByVenue={liveEventsByVenue}
              showRecurrenceEditor
              allowOneTime
              onRecurrenceChange={handleRecurrenceChange}
              onApprove={handleApproveStaged}
              onReject={handleRejectStaged}
              onVenueChange={handleManualVenueChange}
              onSourceUrlChange={handleManualSourceUrlChange}
              onImageChange={handleManualImageChange}
              onVenueWebsiteEventsChange={handleVenueWebsiteEventsChange}
              onVenueInstagramChange={handleVenueInstagramChange}
              onSaveApproved={handleSaveApprovedStaged}
              onDeleteApproved={handleDeleteApproved}
              onCancelOccurrence={handleCancelOccurrence}
              onCreateVenue={handleCreateVenueForSubmission}
              emptyLabel="user"
            />
          )}

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
                  returnPath="/profile/admin"
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
                <OrganizerCard key={organizer.id} organizer={organizer} returnPath="/profile/admin?tab=overview" />
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
              venues={venues}
              scope="scraped"
              liveEventsByVenue={liveEventsByVenue}
              onApprove={handleApproveStaged}
              onReject={handleRejectStaged}
              onDuplicate={handleDuplicateStaged}
              onVenueChange={handleManualVenueChange}
              onSourceUrlChange={handleManualSourceUrlChange}
              onImageChange={handleManualImageChange}
              onVenueWebsiteEventsChange={handleVenueWebsiteEventsChange}
              onVenueInstagramChange={handleVenueInstagramChange}
              onMoveToRecurring={handleMoveScrapedToRecurring}
              onSaveApproved={handleSaveApprovedStaged}
              onDeleteApproved={handleDeleteApproved}
              onUpdateApplied={() => {
                loadScrapedEvents({ silent: true });
                loadPendingEventCounts();
              }}
              onAutoApprove={handleAutoApproveScraped}
              emptyLabel="scraped"
            />
          )}

          {activeBarTab === "manual" && (
            <StagedEventsList
              events={manualEvents}
              loading={manualLoading}
              filter={manualFilter}
              onFilterChange={setManualFilter}
              query={manualQuery}
              onQueryChange={setManualQuery}
              onCreateBlank={() => handleCreateBlank("manual")}
              venues={venues}
              scope="manual"
              liveEventsByVenue={liveEventsByVenue}
              onApprove={handleApproveStaged}
              onReject={handleRejectStaged}
              onCancel={handleCancelStaged}
              onDuplicate={handleDuplicateStaged}
              onVenueChange={handleManualVenueChange}
              onSourceUrlChange={handleManualSourceUrlChange}
              onImageChange={handleManualImageChange}
              onVenueWebsiteEventsChange={handleVenueWebsiteEventsChange}
              onVenueInstagramChange={handleVenueInstagramChange}
              onMoveToRecurring={handleMoveManualToRecurring}
              onSaveApproved={handleSaveApprovedStaged}
              onDeleteApproved={handleDeleteApproved}
              emptyLabel="manual"
            />
          )}

          {activeBarTab === "recurring" && (
            <StagedEventsList
              events={recurringEvents}
              loading={recurringLoading}
              filter={recurringFilter}
              onFilterChange={setRecurringFilter}
              query={recurringQuery}
              onQueryChange={setRecurringQuery}
              onCreateBlank={() => handleCreateBlank("recurring")}
              showRecurrenceEditor={true}
              onRecurrenceChange={handleRecurrenceChange}
              venues={venues}
              scope="recurring"
              liveEventsByVenue={liveEventsByVenue}
              onApprove={handleApproveStaged}
              onReject={handleRejectStaged}
              onCancel={handleCancelStaged}
              onDuplicate={handleDuplicateStaged}
              onVenueChange={handleManualVenueChange}
              onSourceUrlChange={handleManualSourceUrlChange}
              onImageChange={handleManualImageChange}
              onApprovedSeriesImageChange={handleApprovedSeriesImageChange}
              onVenueWebsiteEventsChange={handleVenueWebsiteEventsChange}
              onVenueInstagramChange={handleVenueInstagramChange}
              onSaveApproved={handleSaveApprovedStaged}
              onDeleteApproved={handleDeleteApproved}
              onCancelOccurrence={handleCancelOccurrence}
              emptyLabel="recurring"
            />
          )}

          {activeBarTab === "all-bars" && (
            <div className="space-y-3">
              {allBarsLoading && <div className="flex justify-center py-4"><Spinner /></div>}
              {!allBarsLoading && (() => {
                const q = allBarsQuery.trim().toLowerCase();
                const filtered = allBars.filter(({ venue, hasOwner }) => {
                  if (q && !(
                    venue.name.toLowerCase().includes(q) ||
                    venue.address.toLowerCase().includes(q) ||
                    venue.neighborhood.toLowerCase().includes(q)
                  )) return false;
                  if (allBarsScrapeFilter === "yes" && !venue.scrapeEnabled) return false;
                  if (allBarsScrapeFilter === "no" && venue.scrapeEnabled) return false;
                  if (allBarsIgScrapeFilter === "yes" && !venue.instagramScrapeEnabled) return false;
                  if (allBarsIgScrapeFilter === "no" && venue.instagramScrapeEnabled) return false;
                  if (allBarsClaimFilter === "claimed" && !hasOwner) return false;
                  if (allBarsClaimFilter === "unclaimed" && hasOwner) return false;
                  return true;
                });
                return (
                  <>
                    <input
                      type="search"
                      value={allBarsQuery}
                      onChange={(e) => setAllBarsQuery(e.target.value)}
                      placeholder="Search by name, address or neighborhood…"
                      className="w-full h-10 px-3 mb-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                    />
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs mb-2">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Web:</span>
                        {(["all", "yes", "no"] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setAllBarsScrapeFilter(v)}
                            className={`px-2 h-7 rounded-sm border ${
                              allBarsScrapeFilter === v
                                ? "border-foreground bg-foreground text-background"
                                : "border-border hover:bg-muted"
                            }`}
                          >
                            {v === "all" ? "All" : v === "yes" ? "On" : "Off"}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">IG:</span>
                        {(["all", "yes", "no"] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setAllBarsIgScrapeFilter(v)}
                            className={`px-2 h-7 rounded-sm border ${
                              allBarsIgScrapeFilter === v
                                ? "border-foreground bg-foreground text-background"
                                : "border-border hover:bg-muted"
                            }`}
                          >
                            {v === "all" ? "All" : v === "yes" ? "On" : "Off"}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Claim:</span>
                        {(["all", "claimed", "unclaimed"] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setAllBarsClaimFilter(v)}
                            className={`px-2 h-7 rounded-sm border ${
                              allBarsClaimFilter === v
                                ? "border-foreground bg-foreground text-background"
                                : "border-border hover:bg-muted"
                            }`}
                          >
                            {v === "all" ? "All" : v === "claimed" ? "Claimed" : "Unclaimed"}
                          </button>
                        ))}
                      </div>
                      <span className="text-muted-foreground ml-auto">
                        {filtered.length} of {allBars.length} bars
                      </span>
                    </div>
                    {filtered.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No bars match your filters.</p>
                    ) : (
                      filtered.map(({ venue, hasOwner }) => (
                        <BarCard
                          key={venue.id}
                          venue={venue}
                          hasOwner={hasOwner}
                          events={(liveEventsByVenue[venue.id] ?? []).filter(e => e.status === "approved")}
                          onToggleScrapeEnabled={handleToggleScrapeEnabled}
                          onToggleInstagramScrapeEnabled={handleToggleInstagramScrapeEnabled}
                          onToggleVisible={handleToggleVisible}
                          onLinkChange={handleVenueLinkChange}
                          onDeleteEvent={handleDeleteApprovedSingle}
                        />
                      ))
                    )}
                  </>
                );
              })()}
            </div>
          )}
    </div>
  );
}

function BarCard({
  venue,
  hasOwner,
  events,
  onToggleScrapeEnabled,
  onToggleInstagramScrapeEnabled,
  onToggleVisible,
  onLinkChange,
  onDeleteEvent,
}: {
  venue: Venue;
  hasOwner: boolean;
  events: LiveEventInfo[];
  onToggleScrapeEnabled: (venueId: string, next: boolean) => void;
  onToggleInstagramScrapeEnabled: (venueId: string, next: boolean) => void;
  onToggleVisible: (venueId: string, next: boolean) => void;
  onLinkChange: (
    venueId: string,
    patch: { website?: string | null; instagram?: string | null; websiteEvents?: string | null },
  ) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
}) {
  const [website, setWebsite] = useState(venue.website ?? "");
  const [instagram, setInstagram] = useState(venue.instagram ?? "");
  const [websiteEvents, setWebsiteEvents] = useState(venue.websiteEvents ?? "");
  const [saving, setSaving] = useState(false);
  const [showEvents, setShowEvents] = useState(false);

  useEffect(() => { setWebsite(venue.website ?? ""); }, [venue.website]);
  useEffect(() => { setInstagram(venue.instagram ?? ""); }, [venue.instagram]);
  useEffect(() => { setWebsiteEvents(venue.websiteEvents ?? ""); }, [venue.websiteEvents]);

  const normalize = (v: string) => v.trim() || null;
  const websiteDirty = normalize(website) !== (venue.website ?? null);
  const instagramDirty = normalize(instagram) !== (venue.instagram ?? null);
  const websiteEventsDirty = normalize(websiteEvents) !== (venue.websiteEvents ?? null);
  const dirty = websiteDirty || instagramDirty || websiteEventsDirty;

  const handleSave = async () => {
    if (!dirty || saving) return;
    const patch: { website?: string | null; instagram?: string | null; websiteEvents?: string | null } = {};
    if (websiteDirty) patch.website = normalize(website);
    if (instagramDirty) patch.instagram = normalize(instagram);
    if (websiteEventsDirty) patch.websiteEvents = normalize(websiteEvents);
    setSaving(true);
    try {
      await onLinkChange(venue.id, patch);
    } finally {
      setSaving(false);
    }
  };

  const instagramHref = instagram
    ? /^https?:\/\//i.test(instagram)
      ? instagram
      : `https://instagram.com/${instagram.replace(/^@/, "")}`
    : null;

  return (
    <div className="border border-border rounded-sm">
    <div className="p-4 flex flex-col sm:flex-row sm:items-start gap-3">
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-serif text-sm font-semibold">{venue.name}</p>
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
      <div className="flex gap-2 flex-shrink-0 flex-wrap">
        {dirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm text-xs font-medium border bg-foreground text-background border-foreground hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowEvents(v => !v)}
          aria-expanded={showEvents}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm text-xs font-medium border border-border hover:bg-muted transition-colors"
        >
          <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${showEvents ? "rotate-180" : ""}`} />
          {showEvents ? "Hide events" : `Events (${events.length})`}
        </button>
        <button
          type="button"
          onClick={() => onToggleScrapeEnabled(venue.id, !venue.scrapeEnabled)}
          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-sm text-xs font-medium border transition-colors ${
            venue.scrapeEnabled
              ? "bg-green-500/10 text-green-600 border-green-500/40 hover:bg-green-500/20"
              : "bg-red-500/10 text-red-600 border-red-500/40 hover:bg-red-500/20"
          }`}
          title={`Web scraping: ${venue.scrapeEnabled ? "yes" : "no"}. Click to toggle.`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${venue.scrapeEnabled ? "bg-green-500" : "bg-red-500"}`} />
          Web scraping: {venue.scrapeEnabled ? "yes" : "no"}
        </button>
        <button
          type="button"
          onClick={() => onToggleInstagramScrapeEnabled(venue.id, !venue.instagramScrapeEnabled)}
          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-sm text-xs font-medium border transition-colors ${
            venue.instagramScrapeEnabled
              ? "bg-green-500/10 text-green-600 border-green-500/40 hover:bg-green-500/20"
              : "bg-red-500/10 text-red-600 border-red-500/40 hover:bg-red-500/20"
          }`}
          title={`IG scraping: ${venue.instagramScrapeEnabled ? "yes" : "no"}. Click to toggle.`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${venue.instagramScrapeEnabled ? "bg-green-500" : "bg-red-500"}`} />
          IG scraping: {venue.instagramScrapeEnabled ? "yes" : "no"}
        </button>
        <button
          type="button"
          onClick={() => onToggleVisible(venue.id, !venue.isVisible)}
          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-sm text-xs font-medium border transition-colors ${
            venue.isVisible
              ? "bg-green-500/10 text-green-600 border-green-500/40 hover:bg-green-500/20"
              : "bg-red-500/10 text-red-600 border-red-500/40 hover:bg-red-500/20"
          }`}
          title={`Online: ${venue.isVisible ? "yes" : "no"}. Click to toggle.`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${venue.isVisible ? "bg-green-500" : "bg-red-500"}`} />
          Online: {venue.isVisible ? "yes" : "no"}
        </button>
      </div>
    </div>
    {showEvents && (
      <div className="border-t border-border p-4">
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">No upcoming events.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {events.map((e) => (
              <div
                key={e.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs py-1.5"
              >
                <span className="text-muted-foreground flex-1 min-w-0 truncate">
                  {formatDateWithDay(e.date)}{e.startTime ? ` · ${e.startTime}` : ""} — {e.title}
                </span>
                <div className="flex gap-3 sm:justify-end flex-shrink-0">
                  <Link
                    to={`/event/${e.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Eye className="h-3 w-3" /> Show
                  </Link>
                  <Link
                    to={`/edit-event/${e.id}?scope=single&from=admin-all-bars`}
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Edit className="h-3 w-3" /> Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => onDeleteEvent(e.id)}
                    className="inline-flex items-center gap-1 text-destructive hover:text-destructive/80 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )}
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
  const submitted = organizer.createdAt ? formatTimestampAsBerlinDate(organizer.createdAt) : null;
  const decided = organizer.approvedAt ? formatTimestampAsBerlinDate(organizer.approvedAt) : null;
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

  const canShowEvents = organizer.approvalStatus === "approved";
  const [eventsOpen, setEventsOpen] = useState(false);
  const [events, setEvents] = useState<BarlinEvent[] | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  useEffect(() => {
    if (!canShowEvents) return;
    let cancelled = false;
    setEventsLoading(true);
    setEventsError(null);
    fetchEventsByCreator(organizer.id)
      .then((rows) => { if (!cancelled) setEvents(rows); })
      .catch(() => { if (!cancelled) setEventsError("Failed to load events."); })
      .finally(() => { if (!cancelled) setEventsLoading(false); });
    return () => { cancelled = true; };
  }, [canShowEvents, organizer.id]);

  const handleToggleEvents = () => setEventsOpen((prev) => !prev);

  const upcomingSeries = (() => {
    if (!events) return [];
    const parents = events.filter((e) => !e.parentId);
    const membersBySeries = new Map<string, BarlinEvent[]>();
    for (const e of events) {
      const seriesId = e.parentId || e.id;
      const arr = membersBySeries.get(seriesId) ?? [];
      arr.push(e);
      membersBySeries.set(seriesId, arr);
    }
    const nextOf = (parent: BarlinEvent): BarlinEvent | null => {
      const upc = (membersBySeries.get(parent.id) ?? [parent])
        .filter((m) => m.status !== "canceled" && !isEventInPast(m))
        .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
      return upc[0] ?? null;
    };
    return parents
      .map((p) => ({ parent: p, next: nextOf(p) }))
      .filter((x): x is { parent: BarlinEvent; next: BarlinEvent } => x.next !== null)
      .sort((a, b) => a.next.date.localeCompare(b.next.date) || a.next.startTime.localeCompare(b.next.startTime));
  })();

  return (
    <div className="border border-border rounded-sm">
      <div className="p-4 flex flex-col sm:flex-row sm:items-start gap-3">
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-serif text-sm font-semibold">{display?.name ?? "(no venue)"}</p>
          {isSubmittedBar && (
            <span className="text-xs px-2 py-0.5 rounded-sm font-medium bg-blue-500/10 text-blue-600">
              Bar not yet in table
            </span>
          )}
          {isClaim && (() => {
            const c = organizer.pendingClaim!;
            const changes: string[] = [];
            if (c.proposedWebsite   && c.proposedWebsite   !== c.venueWebsite)   changes.push(`website → ${c.proposedWebsite}`);
            if (c.proposedInstagram && c.proposedInstagram !== c.venueInstagram) changes.push(`instagram → ${c.proposedInstagram}`);
            if (c.proposedPhone     && c.proposedPhone     !== c.venuePhone)     changes.push(`phone → ${c.proposedPhone}`);
            return (
              <span className="text-xs px-2 py-0.5 rounded-sm font-medium bg-yellow-500/10 text-yellow-700">
                {changes.length > 0
                  ? `Claim — proposed: ${changes.join(" · ")}`
                  : "Claim — no changes proposed"}
              </span>
            );
          })()}
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
        {isClaim && organizer.pendingClaim && organizer.pendingClaim.existingOwners.length > 0 && (
          <div className="text-xs px-2 py-1.5 rounded-sm bg-red-500/10 text-red-700 border border-red-500/20">
            Already claimed by:{" "}
            {organizer.pendingClaim.existingOwners
              .map((o) => `${o.name}${o.email ? ` (${o.email})` : ""}`)
              .join(", ")}
          </div>
        )}
        {isClaim && organizer.pendingClaim && organizer.pendingClaim.otherPendingClaims.length > 0 && (
          <div className="text-xs px-2 py-1.5 rounded-sm bg-orange-500/10 text-orange-700 border border-orange-500/20">
            Other pending claim(s) for this venue:{" "}
            {organizer.pendingClaim.otherPendingClaims
              .map((c) => `${c.name}${c.email ? ` (${c.email})` : ""}`)
              .join(", ")}
          </div>
        )}
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
      <div className="flex gap-2 flex-shrink-0 flex-wrap">
        {canShowEvents && (
          <button
            type="button"
            onClick={handleToggleEvents}
            aria-expanded={eventsOpen}
            className="inline-flex items-center gap-1 h-8 px-3 border border-border rounded-sm text-xs font-medium hover:bg-muted"
            title={eventsOpen ? "Hide events" : "Show events"}
          >
            <CalendarDays className="h-3 w-3" />
            {eventsOpen ? "Hide Events" : "Show Events"}
            {events !== null && (
              <span className="text-muted-foreground">({upcomingSeries.length})</span>
            )}
            <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${eventsOpen ? "rotate-180" : ""}`} />
          </button>
        )}
        {(organizer.venue || organizer.pendingSubmission || organizer.pendingClaim) && (
          <Link
            to={`/profile/admin/bar-account/${organizer.id}`}
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
      {canShowEvents && eventsOpen && (
        <div className="border-t border-border px-4 py-3">
          {eventsLoading && (
            <div className="flex justify-center py-4"><Spinner /></div>
          )}
          {!eventsLoading && eventsError && (
            <p className="text-xs text-red-600">{eventsError}</p>
          )}
          {!eventsLoading && !eventsError && upcomingSeries.length === 0 && (
            <p className="text-xs text-muted-foreground">No upcoming events.</p>
          )}
          {!eventsLoading && !eventsError && upcomingSeries.length > 0 && (
            <ul className="divide-y divide-border/50">
              {upcomingSeries.map(({ parent, next }) => {
                const recurrenceLabel = formatRecurrenceLabel(parent.recurrence);
                const statusClass =
                  next.status === "approved"
                    ? "bg-green-500/10 text-green-600"
                    : next.status === "rejected"
                    ? "bg-red-500/10 text-red-600"
                    : "bg-yellow-500/10 text-yellow-600";
                const statusLabel = next.status === "approved" ? "online" : next.status ?? "pending";
                return (
                  <li key={parent.id} className="flex items-center gap-3 py-2 text-xs">
                    <span className="text-muted-foreground whitespace-nowrap">
                      {formatDateWithDay(next.date)}
                      {next.startTime ? ` · ${next.startTime}` : ""}
                    </span>
                    <span className="font-medium truncate flex-1 min-w-0">{parent.title}</span>
                    {recurrenceLabel && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-muted text-muted-foreground whitespace-nowrap">
                        <Repeat className="h-3 w-3" /> {recurrenceLabel}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-sm font-medium capitalize whitespace-nowrap ${statusClass}`}>
                      {statusLabel}
                    </span>
                    <Link
                      to={`/event/${next.id}`}
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground whitespace-nowrap"
                      title="View event"
                    >
                      <Eye className="h-3 w-3" /> View
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function StagedEventCard({
  staged,
  liveEvents,
  venues,
  showRecurrenceEditor,
  onRecurrenceChange,
  onApprove,
  onReject,
  onCancel,
  onDuplicate,
  onVenueChange,
  onSourceUrlChange,
  onImageChange,
  onApprovedSeriesImageChange,
  onVenueWebsiteEventsChange,
  onVenueInstagramChange,
  onMoveToRecurring,
  onSaveApproved,
  onDeleteApproved,
  onCancelOccurrence,
  onUpdateApplied,
  onCreateVenue,
  allowOneTime,
  scope,
}: {
  staged: StagedEvent;
  liveEvents: LiveEventInfo[];
  venues: Venue[];
  showRecurrenceEditor?: boolean;
  onRecurrenceChange?: (patch: { recurrence?: string; recurrenceUntil?: string | null }) => Promise<void>;
  onApprove: (edits: StagedEventEdits) => Promise<void>;
  onReject: () => void;
  onCancel?: () => void;
  onDuplicate?: (edits: StagedEventEdits) => Promise<void>;
  onVenueChange: (venueId: string) => Promise<void>;
  onSourceUrlChange: (url: string) => Promise<void>;
  // Replace (File) or remove (null) the staged cover image. The thumbnail above
  // the card mirrors what the event-detail hero will look like on approve.
  onImageChange: (file: File | null) => Promise<void>;
  // Approved-card cover edit, written to the live `events` row series-wide.
  // Only wired for the recurring scope; when absent, approved cards stay
  // read-only for images (the previous behaviour).
  onApprovedSeriesImageChange?: (file: File | null) => Promise<void>;
  onVenueWebsiteEventsChange: (venueId: string, value: string | null) => Promise<void>;
  onVenueInstagramChange: (venueId: string, value: string | null) => Promise<void>;
  onMoveToRecurring?: () => Promise<void>;
  onSaveApproved: (edits: StagedEventEdits) => Promise<void>;
  onDeleteApproved?: () => Promise<void>;
  onCancelOccurrence?: (sibling?: { id: string; date: string }) => Promise<void>;
  onUpdateApplied?: () => void;
  // User-events tab only: turn a typed-venue submission (no venue_id) into a
  // real bar + link it. Absent for the scraped/manual/recurring scopes.
  onCreateVenue?: (submission: SubmissionVenueData) => Promise<void>;
  // Allow a "— One-time —" choice in the recurrence editor (user events mix
  // single + recurring submissions); the recurring tab keeps it off.
  allowOneTime?: boolean;
  // Which moderation list this card lives in. User submissions must stay
  // time-bounded, so the "No end date" toggle is hidden for scope === "user".
  scope: "scraped" | "manual" | "recurring" | "user";
}) {
  const { data: categoriesData = [] } = useCategories();
  // Form holds the slug-id (categories.id) as the value; we display the label.
  const categories = useMemo(
    () => categoriesData.filter((c) => c.enabled),
    [categoriesData],
  );
  const [title, setTitle] = useState(staged.title);
  const [date, setDate] = useState(staged.date);
  const [startTime, setStartTime] = useState(staged.startTime ?? "");
  const [endTime, setEndTime] = useState(staged.endTime ?? "");
  const [doorsTime, setDoorsTime] = useState(staged.doorsTime ?? "");
  const [showDoors, setShowDoors] = useState(!!staged.doorsTime);
  const [category, setCategory] = useState(staged.category ?? "");
  const [language, setLanguage] = useState(staged.language);
  const [description, setDescription] = useState(staged.description);
  const [entryInfo, setEntryInfo] = useState(staged.entryInfo);
  const [entryCustomMode, setEntryCustomMode] = useState<boolean>(
    () => staged.entryInfo !== "" && !PREDEFINED_ENTRY_OPTIONS.has(staged.entryInfo),
  );
  const [sourceUrlInput, setSourceUrlInput] = useState(staged.sourceUrl ?? "");
  const [venueIdLocal, setVenueIdLocal] = useState(staged.venueId);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingClash, setConfirmingClash] = useState(false);
  const [confirmingNoStartTime, setConfirmingNoStartTime] = useState(false);
  const [datesExpanded, setDatesExpanded] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Approved cards target the live `events` row (series-wide); pending cards
  // target their staging row. Same UI, different write path.
  const applyImageChange = (file: File | null) =>
    staged.status === "approved" ? onApprovedSeriesImageChange?.(file) : onImageChange(file);

  const handleImageFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    setImageBusy(true);
    try {
      await applyImageChange(file);
    } finally {
      setImageBusy(false);
    }
  };

  const handleImageRemove = async () => {
    setImageBusy(true);
    try {
      await applyImageChange(null);
    } finally {
      setImageBusy(false);
    }
  };

  // Re-sync local state when the underlying staged row changes from outside
  // (e.g., after a save the parent updates the list — without this the
  // dirty-check below would see local !== staged and keep showing Save).
  useEffect(() => { setTitle(staged.title); }, [staged.title]);
  useEffect(() => { setDate(staged.date); }, [staged.date]);
  useEffect(() => { setStartTime(staged.startTime ?? ""); }, [staged.startTime]);
  useEffect(() => { setEndTime(staged.endTime ?? ""); }, [staged.endTime]);
  useEffect(() => {
    setDoorsTime(staged.doorsTime ?? "");
    setShowDoors(!!staged.doorsTime);
  }, [staged.doorsTime]);
  useEffect(() => { setCategory(staged.category ?? ""); }, [staged.category]);
  useEffect(() => { setLanguage(staged.language); }, [staged.language]);
  useEffect(() => { setDescription(staged.description); }, [staged.description]);
  useEffect(() => {
    setEntryInfo(staged.entryInfo);
    setEntryCustomMode(staged.entryInfo !== "" && !PREDEFINED_ENTRY_OPTIONS.has(staged.entryInfo));
  }, [staged.entryInfo]);
  useEffect(() => { setSourceUrlInput(staged.sourceUrl ?? ""); }, [staged.sourceUrl]);
  useEffect(() => { setVenueIdLocal(staged.venueId); }, [staged.venueId]);

  // Draft persistence — survives tab switches
  const DRAFT_KEY = `admin-draft-${staged.id}`;
  // Load saved draft on mount. Runs after the sync effects above so it wins.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      if (d.title !== undefined) setTitle(d.title);
      if (d.date !== undefined) setDate(d.date);
      if (d.startTime !== undefined) setStartTime(d.startTime);
      if (d.endTime !== undefined) setEndTime(d.endTime);
      if (d.doorsTime !== undefined) { setDoorsTime(d.doorsTime); setShowDoors(!!d.doorsTime); }
      if (d.category !== undefined) setCategory(d.category);
      if (d.language !== undefined) setLanguage(d.language);
      if (d.description !== undefined) setDescription(d.description);
      if (d.entryInfo !== undefined) {
        setEntryInfo(d.entryInfo);
        setEntryCustomMode(d.entryInfo !== "" && !PREDEFINED_ENTRY_OPTIONS.has(d.entryInfo));
      }
      if (d.sourceUrlInput !== undefined) setSourceUrlInput(d.sourceUrlInput);
      if (d.venueIdLocal !== undefined) setVenueIdLocal(d.venueIdLocal);
    } catch { localStorage.removeItem(DRAFT_KEY); }
  }, []); // intentionally empty — load once on mount
  // Save draft whenever a field changes. Skip the very first render so we
  // don't immediately overwrite a just-loaded draft with staged values.
  const _draftFirstRender = useRef(true);
  useEffect(() => {
    if (_draftFirstRender.current) { _draftFirstRender.current = false; return; }
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      title, date, startTime, endTime, doorsTime, category, language,
      description, entryInfo, sourceUrlInput, venueIdLocal,
    }));
  }, [title, date, startTime, endTime, doorsTime, category, language, description, entryInfo, sourceUrlInput, venueIdLocal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Inline editor for venues.website_events (the bar's events page URL).
  // Seeded from the venues prop so a save in one card is reflected when
  // another card of the same bar is opened (parent updates `venues`).
  const currentVenue = venues.find(v => v.id === staged.venueId);
  const [eventsUrlOpen, setEventsUrlOpen] = useState(false);
  const [eventsUrlInput, setEventsUrlInput] = useState(currentVenue?.websiteEvents ?? "");
  const [eventsUrlSubmitting, setEventsUrlSubmitting] = useState(false);
  useEffect(() => {
    setEventsUrlInput(currentVenue?.websiteEvents ?? "");
  }, [staged.venueId, currentVenue?.websiteEvents]);

  const [instagramOpen, setInstagramOpen] = useState(false);
  const [instagramInput, setInstagramInput] = useState(currentVenue?.instagram ?? "");
  const [instagramSubmitting, setInstagramSubmitting] = useState(false);
  useEffect(() => {
    setInstagramInput(currentVenue?.instagram ?? "");
  }, [staged.venueId, currentVenue?.instagram]);

  // Diff-modal state for staging rows that propose updates to a live event
  // (replaces_event_id is set). Modal opens on demand; we lazily fetch the
  // live event the first time the admin clicks "Show diff".
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffLiveEvent, setDiffLiveEvent] = useState<BarlinEvent | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const handleOpenDiff = async () => {
    if (!staged.replacesEventId) return;
    setDiffLoading(true);
    try {
      const live = await fetchEventById(staged.replacesEventId);
      if (!live) {
        toast.error("Live event not found — it may have been deleted");
        return;
      }
      setDiffLiveEvent(live);
      setDiffOpen(true);
    } catch (e) {
      toast.error(`Failed to load live event: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDiffLoading(false);
    }
  };

  const seriesDates: string[] = (() => {
    if (!date) return [];
    if (showRecurrenceEditor && staged.recurrence && staged.recurrenceUntil) {
      try {
        const dates = generateOccurrences(date, staged.recurrence as RecurrenceFreq, staged.recurrenceUntil);
        return dates.length > 0 ? dates : [date];
      } catch {
        return [date];
      }
    }
    return [date];
  })();
  const seriesDateSet = new Set(seriesDates);
  const sameDayEvents = liveEvents.filter(e => seriesDateSet.has(e.date));

  const isPending = staged.status === "pending";
  const isApproved = staged.status === "approved";
  // Approved cover editing is opt-in per scope (recurring passes the handler).
  // When on, the same thumbnail controls write the cover to the whole series.
  const seriesImageMode = isApproved && !!onApprovedSeriesImageChange;
  const canEdit = isPending || isApproved;
  const isManual = staged.isManual;
  const canEditManualFields = canEdit && (isManual || isApproved);
  const isDirty =
    title !== staged.title ||
    date !== staged.date ||
    startTime !== (staged.startTime ?? "") ||
    endTime !== (staged.endTime ?? "") ||
    doorsTime !== (staged.doorsTime ?? "") ||
    category !== (staged.category ?? "") ||
    language !== staged.language ||
    description !== staged.description ||
    entryInfo !== staged.entryInfo ||
    sourceUrlInput !== (staged.sourceUrl ?? "") ||
    venueIdLocal !== staged.venueId;
  const statusPill =
    staged.status === "approved"
      ? "bg-green-500/10 text-green-600"
      : "bg-yellow-500/10 text-yellow-600";

  const collectEdits = (): StagedEventEdits => ({
    title: title.trim(),
    date,
    startTime: startTime || null,
    endTime: endTime || null,
    doorsTime: doorsTime || null,
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
      localStorage.removeItem(DRAFT_KEY);
    } finally {
      setSubmitting(false);
      setConfirmingClash(false);
      setConfirmingNoStartTime(false);
    }
  };

  const isConfirming = confirmingNoStartTime || confirmingClash;
  const cancelConfirming = () => {
    setConfirmingClash(false);
    setConfirmingNoStartTime(false);
  };

  const handleApprove = async () => {
    // 1. Required fields
    const missing: string[] = [];
    if (!title.trim()) missing.push("title");
    if (!date) missing.push("date");
    if (!category) missing.push("category");
    if (missing.length > 0) {
      toast.error(`Missing required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`);
      return;
    }
    // A typed-venue submission must get a bar (create or link) before approve —
    // scraped/manual/recurring rows always have one, so this only hits user rows.
    if (!staged.venueId) {
      toast.error("This submission has a typed venue — create a bar or pick one above first.");
      return;
    }
    // 2. Show all applicable warnings together in a single confirmation step
    if (!isConfirming) {
      const needsStartTimeWarning = !startTime;
      const needsClashWarning = sameDayEvents.length > 0;
      if (needsStartTimeWarning || needsClashWarning) {
        setConfirmingNoStartTime(needsStartTimeWarning);
        setConfirmingClash(needsClashWarning);
        return;
      }
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
      localStorage.removeItem(DRAFT_KEY);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDateChange = (newDate: string) => {
    const oldDate = date;
    setDate(newDate);
    if (!showRecurrenceEditor || !onRecurrenceChange || !newDate) return;
    if (staged.recurrenceUntil == null) return; // indefinite — no window to preserve
    const newStart = parse(newDate, "yyyy-MM-dd", new Date());
    if (isNaN(newStart.getTime())) return;

    const oldStart = oldDate ? parse(oldDate, "yyyy-MM-dd", new Date()) : null;
    const oldUntil = parse(staged.recurrenceUntil, "yyyy-MM-dd", new Date());
    const hasValidWindow = oldStart && !isNaN(oldStart.getTime()) && !isNaN(oldUntil.getTime());

    const newUntil = hasValidWindow
      ? addDays(newStart, differenceInDays(oldUntil, oldStart))
      : addMonths(newStart, 1);
    onRecurrenceChange({ recurrenceUntil: format(newUntil, "yyyy-MM-dd") });
  };

  const handleCancelApprovedClick = () => {
    setTitle(staged.title);
    setDate(staged.date);
    setStartTime(staged.startTime ?? "");
    setEndTime(staged.endTime ?? "");
    setCategory(staged.category ?? "");
    setLanguage(staged.language);
    setDescription(staged.description);
    setEntryInfo(staged.entryInfo);
    setSourceUrlInput(staged.sourceUrl ?? "");
    setVenueIdLocal(staged.venueId);
  };

  // User events tab, approved: moderators only need to identify the
  // submission, view it, see its dates and delete the series. The full
  // editor (venue tools, form fields, recurrence, inline save) is omitted
  // here on purpose — edits run through the live event detail page (Show
  // event → admin pencil), and per-date editing still happens via the
  // dates list. Pending user cards keep the full editor below.
  if (scope === "user" && isApproved) {
    return (
      <div className="border border-border rounded-sm p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-serif text-sm font-semibold">{staged.title}</p>
          <span className="text-xs text-muted-foreground">
            {staged.venueName}
            {staged.venueNeighborhood ? ` · ${staged.venueNeighborhood}` : ""}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-sm font-medium capitalize ${statusPill}`}>
            {staged.status}
          </span>
        </div>

        {staged.submitter && (
          <p className="text-xs text-muted-foreground">
            Submitted by{" "}
            {(`${staged.submitter.firstName} ${staged.submitter.lastName}`).trim() && (
              <span className="text-foreground font-medium">
                {(`${staged.submitter.firstName} ${staged.submitter.lastName}`).trim()}
                {" · "}
              </span>
            )}
            {staged.submitter.email ? (
              <a href={`mailto:${staged.submitter.email}`} className="text-blue-600 hover:underline">
                {staged.submitter.email}
              </a>
            ) : (
              <span className="italic">no email on file</span>
            )}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => window.open(`/event/${staged.id}`, "_blank")}
            className="inline-flex items-center gap-1 h-8 px-3 border border-border rounded-sm text-xs font-medium hover:bg-muted"
          >
            <ExternalLink className="h-3 w-3" /> Show event
          </button>
          {staged.approvedSiblings && staged.approvedSiblings.length > 1 && (
            <button
              type="button"
              onClick={() => setDatesExpanded((v) => !v)}
              aria-expanded={datesExpanded}
              className="inline-flex items-center gap-1 h-8 px-3 border border-border rounded-sm text-xs font-medium hover:bg-muted"
            >
              <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${datesExpanded ? "rotate-180" : ""}`} />
              {datesExpanded ? "Hide dates" : `All ${staged.approvedSiblings.length} dates`}
            </button>
          )}
          {onDeleteApproved && (
            <button
              onClick={onDeleteApproved}
              disabled={submitting}
              title={
                staged.parentId || staged.recurrence
                  ? "Delete the entire series (all dates) from the site"
                  : "Delete this event from the site"
              }
              className="inline-flex items-center gap-1 h-8 px-3 border border-destructive/40 text-destructive rounded-sm text-xs font-medium hover:bg-destructive/10 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />{" "}
              {staged.parentId || staged.recurrence ? "Delete series" : "Delete"}
            </button>
          )}
        </div>

        {datesExpanded && staged.approvedSiblings && staged.approvedSiblings.length > 1 && (
          <div className="mt-2 pt-2 border-t border-border divide-y divide-border/50">
            {staged.approvedSiblings.map((m) => (
              <div
                key={m.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs py-2 px-2 -mx-2 rounded-sm hover:bg-muted/50"
              >
                <span className="text-muted-foreground flex-1 min-w-0">
                  {formatDateWithDay(m.date)}
                </span>
                <div className="flex gap-3 sm:justify-end flex-shrink-0">
                  <Link
                    to={`/event/${m.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Eye className="h-3 w-3" /> Show
                  </Link>
                  <Link
                    to={`/edit-event/${m.id}?scope=single&from=admin`}
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Edit className="h-3 w-3" /> Edit
                  </Link>
                  {onCancelOccurrence && (
                    <button
                      type="button"
                      onClick={() => onCancelOccurrence({ id: m.id, date: m.date })}
                      disabled={submitting}
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      <Ban className="h-3 w-3" /> Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`border rounded-sm p-4 space-y-3 ${
      staged.replacesEventId
        ? "border-amber-400 dark:border-amber-500/60 bg-amber-50/40 dark:bg-amber-500/5"
        : "border-border"
    }`}>
      {staged.replacesEventId && (
        <div className="flex items-center gap-2 -mx-4 -mt-4 mb-3 px-4 py-2 bg-amber-100/70 dark:bg-amber-500/10 border-b border-amber-300/60 dark:border-amber-500/40">
          <Repeat className="h-4 w-4 text-amber-700 dark:text-amber-400 flex-shrink-0" />
          <span className="text-xs font-mono uppercase tracking-wider font-bold text-amber-800 dark:text-amber-300">
            Update for live event
          </span>
          <button
            type="button"
            onClick={handleOpenDiff}
            disabled={diffLoading}
            className="ml-auto h-7 px-2.5 text-xs border border-amber-400/80 dark:border-amber-500/60 rounded-sm bg-background hover:bg-amber-50 dark:hover:bg-amber-500/10 disabled:opacity-50 font-medium"
          >
            {diffLoading ? "Loading…" : "Show diff"}
          </button>
        </div>
      )}
      {/* Cover image (scraped or user-supplied). Thumbnail uses the same 3:2
          frame the event-detail hero will use on approve, just smaller — so the
          admin sees a faithful preview and can remove / replace a wrong scraped
          pick (or add one when none was scraped). Covers carry into
          events.image on approve. Edit controls show only for real staging rows
          (pending): an "approved" card wraps an `events` row whose id is NOT a
          staging id, so editing here would target the wrong table — those edit
          their cover via the event detail page instead. */}
      {(staged.image || !isApproved || seriesImageMode) && (
        <div className="flex items-start gap-3">
          {staged.image ? (
            <div className="relative w-40 aspect-[3/2] flex-shrink-0 overflow-hidden rounded-sm border border-border">
              <img
                src={staged.image}
                alt=""
                loading="lazy"
                style={{ objectPosition: staged.imagePosition ?? "50% 50%" }}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          ) : null}
          {(!isApproved || seriesImageMode) && (
            <div className="flex flex-col gap-1.5">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={imageBusy}
                className="inline-flex items-center gap-1 h-7 px-2.5 border border-border rounded-sm text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                {imageBusy ? "Working…" : staged.image ? "Replace image" : "Add image"}
              </button>
              {staged.image && (
                <button
                  type="button"
                  onClick={handleImageRemove}
                  disabled={imageBusy}
                  className="inline-flex items-center gap-1 h-7 px-2.5 border border-destructive/40 text-destructive rounded-sm text-xs font-medium hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              )}
              {seriesImageMode && (
                <span className="text-[11px] leading-tight text-muted-foreground max-w-[160px]">
                  Applies to all dates in this series.
                </span>
              )}
            </div>
          )}
        </div>
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
              className="h-8 px-2 bg-muted/50 border border-border rounded-sm text-sm font-serif font-semibold outline-none focus:border-foreground transition-colors"
            >
              {/* Typed-venue submission has no bar yet — show a placeholder so
                  the dropdown doesn't silently default to the first bar. */}
              {!(isApproved ? venueIdLocal : staged.venueId) && (
                <option value="">— No bar yet —</option>
              )}
              {venues.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          ) : (
            <p className="font-serif text-sm font-semibold">{staged.venueName}</p>
          )}
          <button
            type="button"
            onClick={() => setEventsUrlOpen(o => !o)}
            title="Change venues.website_events for this bar"
            className="text-xs px-2 py-0.5 border border-border rounded-sm hover:bg-muted"
          >
            change website_events
          </button>
          {currentVenue?.websiteEvents && (
            <button
              type="button"
              onClick={() => openSourceWindow(currentVenue.websiteEvents!)}
              title="Open bar's events page"
              className="inline-flex items-center justify-center h-5 w-5 border border-border rounded-sm hover:bg-muted flex-shrink-0"
            >
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setInstagramOpen(o => !o)}
            title="Change venues.instagram for this bar"
            className="text-xs px-2 py-0.5 border border-border rounded-sm hover:bg-muted"
          >
            change instagram
          </button>
          {currentVenue?.instagram && (
            <button
              type="button"
              onClick={() => openSourceWindow(
                /^https?:\/\//i.test(currentVenue.instagram!)
                  ? currentVenue.instagram!
                  : `https://instagram.com/${currentVenue.instagram!.replace(/^@/, "")}`
              )}
              title="Open bar's Instagram"
              className="inline-flex items-center justify-center h-5 w-5 border border-border rounded-sm hover:bg-muted flex-shrink-0"
            >
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
          <span className="text-xs text-muted-foreground">
            {staged.venueAddress
              ? staged.venueAddress.replace(/,\s*(Germany|Deutschland)\s*$/i, "")
              : staged.venueNeighborhood}
          </span>
          {staged.createdByAdmin && (
            <span className="text-xs px-2 py-0.5 rounded-sm font-medium bg-blue-500/10 text-blue-600">
              Created manually
            </span>
          )}
          {!isPending && (
            <span className={`text-xs px-2 py-0.5 rounded-sm font-medium capitalize ${statusPill}`}>
              {staged.status}
            </span>
          )}
        </div>
        {isPending && onDuplicate && (
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

      {/* Who submitted this (User events tab) — shown so the moderator can
          follow up. Only user submissions carry a submitter. */}
      {staged.submitter && (
        <p className="text-xs text-muted-foreground">
          Submitted by{" "}
          {(`${staged.submitter.firstName} ${staged.submitter.lastName}`).trim() && (
            <span className="text-foreground font-medium">
              {(`${staged.submitter.firstName} ${staged.submitter.lastName}`).trim()}
              {" · "}
            </span>
          )}
          {staged.submitter.email ? (
            <a href={`mailto:${staged.submitter.email}`} className="text-blue-600 hover:underline">
              {staged.submitter.email}
            </a>
          ) : (
            <span className="italic">no email on file</span>
          )}
        </p>
      )}

      {/* Typed-venue submission (User events tab): the submitter entered a
          venue that isn't a bar yet. Create it from their details + link, or
          pick an existing bar in the dropdown above. Approve is blocked until
          one of those sets a venue_id. */}
      {onCreateVenue && isPending && !staged.venueId && (
        <div className="border border-dashed border-border rounded-sm p-2 space-y-2 bg-muted/20">
          <p className="text-xs text-muted-foreground">
            Typed venue (no bar yet):{" "}
            <span className="font-medium text-foreground">{staged.venueName}</span>
            {staged.venueAddress
              ? ` · ${staged.venueAddress.replace(/,\s*(Germany|Deutschland)\s*$/i, "")}`
              : staged.venueNeighborhood ? ` · ${staged.venueNeighborhood}` : ""}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={submitting || !staged.venueName.trim() || !staged.venueAddress.trim()}
              onClick={async () => {
                setSubmitting(true);
                try {
                  await onCreateVenue({
                    name: staged.venueName,
                    address: staged.venueAddress,
                    neighborhood: staged.venueNeighborhood,
                  });
                } finally {
                  setSubmitting(false);
                }
              }}
              className="inline-flex items-center gap-1 h-8 px-3 border border-border rounded-sm text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              <Plus className="h-3 w-3" /> Create bar &amp; link
            </button>
            <span className="text-xs text-muted-foreground">or pick an existing bar above</span>
          </div>
        </div>
      )}

      {eventsUrlOpen && (
        <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-sm">
          <input
            type="url"
            value={eventsUrlInput}
            onChange={e => setEventsUrlInput(e.target.value)}
            placeholder="venues.website_events URL (leave empty + Set NULL to clear)"
            className="flex-1 h-9 px-2 bg-background border border-border rounded-sm text-sm outline-none focus:border-foreground"
          />
          <button
            type="button"
            disabled={eventsUrlSubmitting}
            onClick={async () => {
              setEventsUrlSubmitting(true);
              try {
                await onVenueWebsiteEventsChange(staged.venueId, eventsUrlInput);
                setEventsUrlOpen(false);
              } finally {
                setEventsUrlSubmitting(false);
              }
            }}
            className="h-9 px-3 text-sm border border-border rounded-sm hover:bg-muted disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            disabled={eventsUrlSubmitting}
            onClick={async () => {
              setEventsUrlSubmitting(true);
              try {
                await onVenueWebsiteEventsChange(staged.venueId, null);
                setEventsUrlInput("");
                setEventsUrlOpen(false);
              } finally {
                setEventsUrlSubmitting(false);
              }
            }}
            className="h-9 px-3 text-sm border border-border rounded-sm hover:bg-muted text-muted-foreground disabled:opacity-50"
          >
            Set NULL
          </button>
          <button
            type="button"
            onClick={() => {
              setEventsUrlInput(currentVenue?.websiteEvents ?? "");
              setEventsUrlOpen(false);
            }}
            className="h-9 px-3 text-sm border border-border rounded-sm hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      )}

      {instagramOpen && (
        <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-sm">
          <input
            type="text"
            value={instagramInput}
            onChange={e => setInstagramInput(e.target.value)}
            placeholder="Instagram handle or URL (leave empty + Set NULL to clear)"
            className="flex-1 h-9 px-2 bg-background border border-border rounded-sm text-sm outline-none focus:border-foreground"
          />
          <button
            type="button"
            disabled={instagramSubmitting}
            onClick={async () => {
              setInstagramSubmitting(true);
              try {
                await onVenueInstagramChange(staged.venueId, instagramInput);
                setInstagramOpen(false);
              } finally {
                setInstagramSubmitting(false);
              }
            }}
            className="h-9 px-3 text-sm border border-border rounded-sm hover:bg-muted disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            disabled={instagramSubmitting}
            onClick={async () => {
              setInstagramSubmitting(true);
              try {
                await onVenueInstagramChange(staged.venueId, null);
                setInstagramInput("");
                setInstagramOpen(false);
              } finally {
                setInstagramSubmitting(false);
              }
            }}
            className="h-9 px-3 text-sm border border-border rounded-sm hover:bg-muted text-muted-foreground disabled:opacity-50"
          >
            Set NULL
          </button>
          <button
            type="button"
            onClick={() => {
              setInstagramInput(currentVenue?.instagram ?? "");
              setInstagramOpen(false);
            }}
            className="h-9 px-3 text-sm border border-border rounded-sm hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      )}

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

      {liveEvents.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Already live ({liveEvents.length}):{" "}
          {liveEvents.map((event, i) => (
            <span key={event.id}>
              {i > 0 && ", "}
              <Link
                to={`/event/${event.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`hover:underline ${event.date === date ? "text-red-600" : "text-blue-600"}`}
                title={event.title}
              >
                {formatDateShort(event.date)}
              </Link>
            </span>
          ))}
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
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={e => handleDateChange(e.target.value)}
          disabled={!canEdit}
          className="h-9 px-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors disabled:opacity-60"
        />
        <div className="space-y-1">
          <div className="flex gap-2 items-center">
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              disabled={!canEdit}
              placeholder="Start"
              title="Start"
              className="flex-1 h-9 px-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors disabled:opacity-60"
            />
            <input
              type="time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              disabled={!canEdit}
              placeholder="End"
              title="End"
              className="flex-1 h-9 px-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors disabled:opacity-60"
            />
            {!showDoors ? (
              <button
                type="button"
                onClick={() => setShowDoors(true)}
                disabled={!canEdit}
                className="h-9 px-3 border border-dashed border-border rounded-sm text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                + Doors
              </button>
            ) : (
              <div className="flex items-center gap-1 flex-1">
                <span className="text-xs text-muted-foreground flex-shrink-0">Doors:</span>
                <input
                  type="time"
                  value={doorsTime}
                  onChange={e => setDoorsTime(e.target.value)}
                  disabled={!canEdit}
                  className="flex-1 min-w-0 h-9 px-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => { setDoorsTime(""); setShowDoors(false); }}
                  disabled={!canEdit}
                  title="Remove doors time"
                  className="h-9 w-9 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          {showDoors && doorsTime && startTime && doorsTime >= startTime && (
            <p className="text-xs text-muted-foreground">Doors are usually before the start time</p>
          )}
        </div>
        <div className="space-y-1.5">
          <select
            value={entryCustomMode ? CUSTOM_ENTRY_SENTINEL : entryInfo}
            onChange={e => {
              const v = e.target.value;
              if (v === CUSTOM_ENTRY_SENTINEL) {
                setEntryCustomMode(true);
                setEntryInfo("");
              } else {
                setEntryCustomMode(false);
                setEntryInfo(v);
              }
            }}
            disabled={!canEdit}
            className="w-full h-9 px-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors disabled:opacity-60"
          >
            <option value="">Check at the door</option>
            <option value="Free">Free</option>
            <option value="Donation">Donation</option>
            <option value={CUSTOM_ENTRY_SENTINEL}>Custom…</option>
            {ENTRY_AMOUNTS.map(label => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
          {entryCustomMode && (
            <input
              type="text"
              value={entryInfo}
              onChange={e => setEntryInfo(e.target.value)}
              placeholder="e.g. First drink costs double"
              disabled={!canEdit}
              className="w-full h-9 px-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors disabled:opacity-60"
            />
          )}
        </div>
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

      {showRecurrenceEditor && onRecurrenceChange && (
        <div className="space-y-2">
          <div className={`grid grid-cols-1 ${staged.recurrenceUntil != null ? "sm:grid-cols-2" : ""} gap-2`}>
            <select
              value={staged.recurrence || ""}
              onChange={(e) => onRecurrenceChange({ recurrence: e.target.value })}
              disabled={!isPending}
              className="h-9 px-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors disabled:opacity-60"
            >
              {/* User events mix single + recurring submissions; let the admin
                  mark one as non-repeating. Other scopes keep this off. */}
              {allowOneTime && <option value="">— One-time (no repeat) —</option>}
              <option value="weekly">Weekly — every week</option>
              <option value="biweekly">Biweekly — 1st+3rd or 2nd+4th weekday</option>
              <option value="monthly_by_weekday">Monthly — same weekday of month</option>
              <option value="monthly_last_weekday">Monthly — last weekday of month</option>
            </select>
            {staged.recurrenceUntil != null && (
              <input
                type="date"
                value={staged.recurrenceUntil}
                onChange={(e) => onRecurrenceChange({ recurrenceUntil: e.target.value || null })}
                disabled={!isPending}
                placeholder="Repeat until"
                className="h-9 px-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors disabled:opacity-60"
              />
            )}
          </div>
          {staged.recurrence && (date || staged.date) && (
            <p className="text-xs text-muted-foreground">
              {describeRule(date || staged.date, staged.recurrence as RecurrenceFreq)}
            </p>
          )}
          {/* User submissions must stay time-bounded (the public form caps them
              at 6 months), so admins don't get the indefinite toggle here. */}
          {scope !== "user" && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={staged.recurrenceUntil == null}
                onChange={(e) => {
                  if (e.target.checked) {
                    onRecurrenceChange({ recurrenceUntil: null });
                  } else {
                    const startStr = date || staged.date;
                    const start = startStr ? parse(startStr, "yyyy-MM-dd", new Date()) : new Date();
                    const fallback = isNaN(start.getTime()) ? addMonths(new Date(), 6) : addMonths(start, 6);
                    onRecurrenceChange({ recurrenceUntil: format(fallback, "yyyy-MM-dd") });
                  }
                }}
                disabled={!isPending}
                className="h-3.5 w-3.5"
              />
              No end date — series runs until you delete it
            </label>
          )}
        </div>
      )}

      {isPending && confirmingNoStartTime && (
        <div className="border border-yellow-500/50 bg-yellow-500/10 rounded-sm p-3 space-y-1">
          <p className="text-xs font-medium text-yellow-700">
            ⚠ Approve without a start time?
          </p>
          <p className="text-xs text-muted-foreground">
            The event will show "No info on start time" to users.
          </p>
        </div>
      )}

      {isPending && confirmingClash && (
        <div className="border border-yellow-500/50 bg-yellow-500/10 rounded-sm p-3 space-y-2">
          <p className="text-xs font-medium text-yellow-700">
            ⚠ {seriesDates.length > 1
              ? sameDayEvents.length === 1
                ? "There is already an event on a date in this series:"
                : `There are already ${sameDayEvents.length} events on dates in this series:`
              : sameDayEvents.length === 1
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
                  {e.title} · {e.date}{e.startTime ? ` · ${e.startTime}` : ""}
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
          {isConfirming ? (
            <>
              <button
                onClick={cancelConfirming}
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
              {onMoveToRecurring && (
                <button
                  onClick={onMoveToRecurring}
                  disabled={submitting}
                  title="Move this card to the Recurring tab (sets is_manual=true, recurrence=weekly)"
                  className="inline-flex items-center gap-1 h-8 px-3 border border-border rounded-sm text-xs font-medium hover:bg-muted disabled:opacity-50"
                >
                  <Repeat className="h-3 w-3" /> Move to Recurring
                </button>
              )}
              {isManual && onCancel ? (
                <button
                  onClick={onCancel}
                  disabled={submitting}
                  className="inline-flex items-center gap-1 h-8 px-3 border border-border rounded-sm text-xs font-medium hover:bg-muted disabled:opacity-50"
                >
                  <X className="h-3 w-3" /> Cancel
                </button>
              ) : (
                <button
                  onClick={() => { localStorage.removeItem(DRAFT_KEY); onReject(); }}
                  disabled={submitting}
                  className="inline-flex items-center gap-1 h-8 px-3 border border-border rounded-sm text-xs font-medium hover:bg-muted disabled:opacity-50"
                >
                  <X className="h-3 w-3" /> Reject
                </button>
              )}
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

      {isApproved && (
        <>
          <div className="flex items-center justify-between gap-2 flex-shrink-0">
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => window.open(`/event/${staged.id}`, "_blank")}
                className="inline-flex items-center gap-1 h-8 px-3 border border-border rounded-sm text-xs font-medium hover:bg-muted"
              >
                <ExternalLink className="h-3 w-3" /> Show event
              </button>
              {onCancelOccurrence && (
                <button
                  onClick={() => onCancelOccurrence()}
                  disabled={submitting}
                  title="Cancel just this date — the rest of the series continues"
                  className="inline-flex items-center gap-1 h-8 px-3 border border-border rounded-sm text-xs font-medium hover:bg-muted disabled:opacity-50"
                >
                  <Ban className="h-3 w-3" /> Cancel date
                </button>
              )}
              {onDeleteApproved && (
                <button
                  onClick={onDeleteApproved}
                  disabled={submitting}
                  title={
                    staged.parentId || staged.recurrence
                      ? "Delete the entire series (all dates) from the site"
                      : "Delete this event from the site"
                  }
                  className="inline-flex items-center gap-1 h-8 px-3 border border-destructive/40 text-destructive rounded-sm text-xs font-medium hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />{" "}
                  {staged.parentId || staged.recurrence ? "Delete series" : "Delete"}
                </button>
              )}
              {staged.approvedSiblings && staged.approvedSiblings.length > 1 && (
                <button
                  type="button"
                  onClick={() => setDatesExpanded((v) => !v)}
                  aria-expanded={datesExpanded}
                  className="inline-flex items-center gap-1 h-8 px-3 border border-border rounded-sm text-xs font-medium hover:bg-muted"
                >
                  <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${datesExpanded ? "rotate-180" : ""}`} />
                  {datesExpanded ? "Hide dates" : `All ${staged.approvedSiblings.length} dates`}
                </button>
              )}
              {scope === "recurring" && (
                <Link
                  to={
                    staged.approvedSiblings && staged.approvedSiblings.length > 1
                      ? `/edit-event/${staged.id}?scope=future&from=admin`
                      : `/edit-event/${staged.id}?from=admin`
                  }
                  className="inline-flex items-center gap-1 h-8 px-3 border border-border rounded-sm text-xs font-medium hover:bg-muted"
                >
                  <Edit className="h-3 w-3" />{" "}
                  {staged.approvedSiblings && staged.approvedSiblings.length > 1 ? "Edit series" : "Edit"}
                </Link>
              )}
            </div>
            {canEdit && isDirty && (
              <div className="flex gap-2">
                <button
                  onClick={handleCancelApprovedClick}
                  disabled={submitting}
                  className="inline-flex items-center gap-1 h-8 px-3 border border-border rounded-sm text-xs font-medium hover:bg-muted disabled:opacity-50"
                >
                  <X className="h-3 w-3" /> Cancel
                </button>
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
          {datesExpanded && staged.approvedSiblings && staged.approvedSiblings.length > 1 && (
            <div className="mt-2 pt-2 border-t border-border divide-y divide-border/50">
              {staged.approvedSiblings.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs py-2 px-2 -mx-2 rounded-sm hover:bg-muted/50"
                >
                  <span className="text-muted-foreground flex-1 min-w-0">
                    {formatDateWithDay(m.date)}
                  </span>
                  <div className="flex gap-3 sm:justify-end flex-shrink-0">
                    <Link
                      to={`/event/${m.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Eye className="h-3 w-3" /> Show
                    </Link>
                    <Link
                      to={`/edit-event/${m.id}?scope=single&from=admin`}
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Edit className="h-3 w-3" /> Edit
                    </Link>
                    {onCancelOccurrence && (
                      <button
                        type="button"
                        onClick={() => onCancelOccurrence({ id: m.id, date: m.date })}
                        disabled={submitting}
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        <Ban className="h-3 w-3" /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {diffOpen && diffLiveEvent && (
        <EventDiffModal
          stagedEvent={staged}
          liveEvent={diffLiveEvent}
          open={diffOpen}
          onClose={() => setDiffOpen(false)}
          onApplied={() => {
            setDiffOpen(false);
            onUpdateApplied?.();
          }}
          onSwitchToManualEdit={() => {
            // Just close the modal — the admin can edit the staging row
            // directly underneath. The fields below are already populated
            // with the scraped values.
            setDiffOpen(false);
          }}
        />
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
  onCreateBlank,
  showRecurrenceEditor,
  onRecurrenceChange,
  liveEventsByVenue,
  venues,
  scope,
  onApprove,
  onReject,
  onCancel,
  onDuplicate,
  onVenueChange,
  onSourceUrlChange,
  onImageChange,
  onApprovedSeriesImageChange,
  onVenueWebsiteEventsChange,
  onVenueInstagramChange,
  onMoveToRecurring,
  onSaveApproved,
  onDeleteApproved,
  onCancelOccurrence,
  onUpdateApplied,
  onCreateVenue,
  onAutoApprove,
  allowOneTime,
  emptyLabel,
}: {
  events: StagedEvent[];
  loading: boolean;
  filter: StagedEventStatusFilter;
  onFilterChange: (f: StagedEventStatusFilter) => void;
  query: string;
  onQueryChange: (q: string) => void;
  onCreateBlank?: () => void;
  showRecurrenceEditor?: boolean;
  onRecurrenceChange?: (id: string, patch: { recurrence?: string; recurrenceUntil?: string | null }) => Promise<void>;
  liveEventsByVenue: Record<string, LiveEventInfo[]>;
  venues: Venue[];
  scope: "scraped" | "manual" | "recurring" | "user";
  onApprove: (s: StagedEvent, edits: StagedEventEdits) => Promise<void>;
  onReject: (s: StagedEvent) => Promise<void>;
  onCancel?: (s: StagedEvent) => Promise<void>;
  onDuplicate?: (s: StagedEvent, edits: StagedEventEdits, scope: "scraped" | "manual" | "recurring") => Promise<void>;
  onVenueChange: (id: string, venueId: string) => Promise<void>;
  onSourceUrlChange: (id: string, url: string) => Promise<void>;
  onImageChange: (id: string, file: File | null) => Promise<void>;
  onApprovedSeriesImageChange?: (s: StagedEvent, file: File | null) => Promise<void>;
  onVenueWebsiteEventsChange: (venueId: string, value: string | null) => Promise<void>;
  onVenueInstagramChange: (venueId: string, value: string | null) => Promise<void>;
  onMoveToRecurring?: (s: StagedEvent) => Promise<void>;
  onSaveApproved: (s: StagedEvent, edits: StagedEventEdits) => Promise<void>;
  onDeleteApproved?: (s: StagedEvent) => Promise<void>;
  onCancelOccurrence?: (s: StagedEvent) => Promise<void>;
  onUpdateApplied?: () => void;
  onCreateVenue?: (s: StagedEvent, submission: SubmissionVenueData) => Promise<void>;
  onAutoApprove?: () => void;
  allowOneTime?: boolean;
  emptyLabel: string;
}) {
  const pills: StagedEventStatusFilter[] = ["pending", "approved"];

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
              {f.charAt(0).toUpperCase() + f.slice(1)}
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
          {onAutoApprove && scope === "scraped" && filter === "pending" && events.length > 0 && (
            <button
              onClick={onAutoApprove}
              className="inline-flex items-center gap-1 h-10 px-3 text-xs font-medium border border-foreground bg-foreground text-background rounded-sm hover:opacity-90"
              title="Approve all pending scraped events (overwrites same-day/same-bar live events)"
            >
              <Check className="h-4 w-4" /> Auto-approve
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
          No {filter} {emptyLabel} events.
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
              showRecurrenceEditor={showRecurrenceEditor}
              onRecurrenceChange={
                onRecurrenceChange
                  ? (patch) => onRecurrenceChange(staged.id, patch)
                  : undefined
              }
              onApprove={(edits) => onApprove(staged, edits)}
              onReject={() => onReject(staged)}
              onCancel={onCancel ? () => onCancel(staged) : undefined}
              onDuplicate={onDuplicate && scope !== "user" ? (edits) => onDuplicate(staged, edits, scope) : undefined}
              onVenueChange={(venueId) => onVenueChange(staged.id, venueId)}
              onSourceUrlChange={(url) => onSourceUrlChange(staged.id, url)}
              onImageChange={(file) => onImageChange(staged.id, file)}
              onApprovedSeriesImageChange={
                onApprovedSeriesImageChange
                  ? (file) => onApprovedSeriesImageChange(staged, file)
                  : undefined
              }
              onVenueWebsiteEventsChange={onVenueWebsiteEventsChange}
              onVenueInstagramChange={onVenueInstagramChange}
              onMoveToRecurring={onMoveToRecurring ? () => onMoveToRecurring(staged) : undefined}
              onSaveApproved={(edits) => onSaveApproved(staged, edits)}
              onDeleteApproved={onDeleteApproved ? () => onDeleteApproved(staged) : undefined}
              onCancelOccurrence={
                onCancelOccurrence
                  ? (sibling?: { id: string; date: string }) =>
                      onCancelOccurrence(
                        sibling
                          ? { ...staged, id: sibling.id, date: sibling.date }
                          : staged,
                      )
                  : undefined
              }
              onUpdateApplied={onUpdateApplied}
              onCreateVenue={onCreateVenue ? (submission) => onCreateVenue(staged, submission) : undefined}
              allowOneTime={allowOneTime}
              scope={scope}
            />
          );
          return <div key={staged.id}>{card}</div>;
        });
      })()}
    </div>
  );
}
