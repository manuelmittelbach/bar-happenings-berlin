import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, addMonths, differenceInDays, format, parse } from "date-fns";
import { generateOccurrences, formatRecurrenceLabel, type RecurrenceFreq } from "@/lib/recurrence";
import { formatDateShort, formatDateWithDay, formatTimestampAsBerlinDate } from "@/lib/dateFormat";
import { isEventInPast } from "@/lib/eventStatus";
import EventDetailView from "@/components/events/EventDetailView";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, X, Building2, Shield, Globe, Instagram, Phone, Edit, CalendarDays, ExternalLink, Plus, Copy, Repeat, ChevronDown, Eye, Trash2, Ban } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { categories } from "@/data/categories";
import { LANGUAGES } from "@/data/languages";
import { CUSTOM_ENTRY_SENTINEL, ENTRY_AMOUNTS, PREDEFINED_ENTRY_OPTIONS } from "@/data/entryOptions";
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
  fetchStagedEventCount,
  fetchApprovedEvents,
  approveStagedEvent,
  rejectStagedEvent,
  moveStagedEventToRecurring,
  deleteStagedEvent,
  fetchLiveEventsByVenue,
  fetchVenues,
  createBlankManualStagedEvent,
  duplicateStagedEvent,
  updateStagedEventManualFields,
  updateApprovedEvent,
  deleteApprovedEvent,
  cancelEvent,
  fetchEventsByCreator,
  type OrganizerAccount,
  type LiveEventInfo,
  type ApprovedEventListItem,
} from "@/lib/supabaseQueries";
import type { BarlinEvent, StagedEvent, StagedEventEdits, StagedEventStatusFilter, Venue } from "@/types/event";

// Approved events live in the `events` table. To keep the existing card UI
// working, adapt them to the StagedEvent shape used by StagedEventCard.
// `status: "approved"` is the virtual marker — staging never stores that.
// siblingDates come from fetchApprovedEvents (sibling rows in `events`); they
// can't be derived from the row alone because recurrence_until isn't stored
// post-approval.
function approvedItemToAdminStaged(item: ApprovedEventListItem): StagedEvent {
  const { event, siblingDates } = item;
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
    recurrence: event.recurrence,
    recurrenceUntil: null,
    interestedCount: event.interestedCount,
    approvedSiblingDates: siblingDates,
  };
}

type BarTab = "pending" | "overview" | "all-bars" | "scraped" | "manual" | "recurring";
type AdminSection = "bars" | "events";

const BAR_TABS: BarTab[] = ["overview", "pending", "all-bars"];
const EVENT_TABS: BarTab[] = ["scraped", "manual", "recurring"];

const sectionOf = (tab: BarTab): AdminSection =>
  tab === "scraped" || tab === "manual" || tab === "recurring" ? "events" : "bars";

const defaultTabFor = (section: AdminSection): BarTab =>
  section === "events" ? "scraped" : "pending";

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
  const [recurringFilter, setRecurringFilter] = useState<StagedEventStatusFilter>("pending");
  const [recurringQuery, setRecurringQuery] = useState("");
  const [liveEventsByVenue, setLiveEventsByVenue] = useState<Record<string, LiveEventInfo[]>>({});
  const [venues, setVenues] = useState<Venue[]>([]);
  const [scrapedPendingCount, setScrapedPendingCount] = useState<number | null>(null);
  const [manualPendingCount, setManualPendingCount] = useState<number | null>(null);
  const [recurringPendingCount, setRecurringPendingCount] = useState<number | null>(null);

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

  const loadPendingEventCounts = useCallback(async () => {
    try {
      const [scraped, manual, recurring] = await Promise.all([
        fetchStagedEventCount("scraped"),
        fetchStagedEventCount("manual"),
        fetchStagedEventCount("recurring"),
      ]);
      setScrapedPendingCount(scraped);
      setManualPendingCount(manual);
      setRecurringPendingCount(recurring);
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
          }, 500);
        },
      )
      .subscribe();
    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [loadScrapedEvents, loadManualEvents, loadRecurringEvents, loadPendingEventCounts]);

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
        const result = await approveOrganizerWithNewBar(organizer.id, user.id);
        approvedVenue = {
          id: result.venueId,
          name: organizer.pendingSubmission.name,
          address: organizer.pendingSubmission.address,
          neighborhood: organizer.pendingSubmission.neighborhood,
          website: organizer.pendingSubmission.website,
          instagram: organizer.pendingSubmission.instagram,
          phone: organizer.pendingSubmission.phone,
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
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success(`"${edits.title ?? staged.title}" approved`);
      setScrapedEvents(prev => prev.filter(s => s.id !== staged.id));
      setManualEvents(prev => prev.filter(s => s.id !== staged.id));
      setRecurringEvents(prev => prev.filter(s => s.id !== staged.id));
      loadPendingEventCounts();
      loadLiveEvents();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to approve event.";
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
      loadPendingEventCounts();
    } catch {
      toast.error("Failed to reject event.");
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
    } catch {
      toast.error("Failed to update URL.");
    }
  };

  const handleRecurrenceChange = async (
    stagedId: string,
    patch: { recurrence?: string; recurrenceUntil?: string | null },
  ) => {
    try {
      await updateStagedEventManualFields(stagedId, patch);
      setRecurringEvents(prev =>
        prev.map(s =>
          s.id === stagedId
            ? {
                ...s,
                recurrence: patch.recurrence !== undefined ? patch.recurrence : s.recurrence,
                recurrenceUntil:
                  patch.recurrenceUntil !== undefined ? patch.recurrenceUntil : s.recurrenceUntil,
              }
            : s,
        ),
      );
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
      await updateApprovedEvent(staged.id, seriesId, edits, venues);
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
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
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
                <span className="text-xs text-muted-foreground font-medium">Pending Events</span>
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </div>
              {scrapedPendingCount === null || manualPendingCount === null || recurringPendingCount === null ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <>
                  <p className="font-heading text-2xl font-bold">{String(scrapedPendingCount + manualPendingCount + recurringPendingCount)}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {scrapedPendingCount} scraped · {manualPendingCount} manual · {recurringPendingCount} recurring
                  </p>
                </>
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
                  ? decidedOrganizersLoading ? "Overview" : `Overview (${decidedOrganizers.length})`
                  : tab === "all-bars"
                  ? allBarsLoading ? "All Bars" : `All Bars (${allBars.length})`
                  : tab === "scraped"
                  ? scrapedLoading ? "Scraped Events" : `Scraped Events (${scrapedEvents.length})`
                  : tab === "manual"
                  ? manualLoading ? "Manual Events" : `Manual Events (${manualEvents.length})`
                  : recurringLoading ? "Recurring Events" : `Recurring Events (${recurringEvents.length})`}
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
              venues={venues}
              scope="scraped"
              liveEventsByVenue={liveEventsByVenue}
              onApprove={handleApproveStaged}
              onReject={handleRejectStaged}
              onDuplicate={handleDuplicateStaged}
              onVenueChange={handleManualVenueChange}
              onSourceUrlChange={handleManualSourceUrlChange}
              onVenueWebsiteEventsChange={handleVenueWebsiteEventsChange}
              onMoveToRecurring={handleMoveScrapedToRecurring}
              onSaveApproved={handleSaveApprovedStaged}
              onDeleteApproved={handleDeleteApproved}
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
              onVenueWebsiteEventsChange={handleVenueWebsiteEventsChange}
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
              onVenueWebsiteEventsChange={handleVenueWebsiteEventsChange}
              onSaveApproved={handleSaveApprovedStaged}
              onDeleteApproved={handleDeleteApproved}
              onCancelOccurrence={handleCancelOccurrence}
              emptyLabel="recurring"
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
  const [saving, setSaving] = useState(false);

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
      <div className="flex gap-2 flex-shrink-0">
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
  onVenueWebsiteEventsChange,
  onMoveToRecurring,
  onSaveApproved,
  onDeleteApproved,
  onCancelOccurrence,
}: {
  staged: StagedEvent;
  liveEvents: LiveEventInfo[];
  venues: Venue[];
  showRecurrenceEditor?: boolean;
  onRecurrenceChange?: (patch: { recurrence?: string; recurrenceUntil?: string | null }) => Promise<void>;
  onApprove: (edits: StagedEventEdits) => Promise<void>;
  onReject: () => void;
  onCancel?: () => void;
  onDuplicate: (edits: StagedEventEdits) => Promise<void>;
  onVenueChange: (venueId: string) => Promise<void>;
  onSourceUrlChange: (url: string) => Promise<void>;
  onVenueWebsiteEventsChange: (venueId: string, value: string | null) => Promise<void>;
  onMoveToRecurring?: () => Promise<void>;
  onSaveApproved: (edits: StagedEventEdits) => Promise<void>;
  onDeleteApproved?: () => Promise<void>;
  onCancelOccurrence?: () => Promise<void>;
}) {
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

  const liveDates = Array.from(new Set(liveEvents.map(e => e.date))).sort();
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

  return (
    <div className="border border-border rounded-sm p-4 space-y-3">
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
          <button
            type="button"
            onClick={() => setEventsUrlOpen(o => !o)}
            title="Change venues.website_events for this bar"
            className="text-xs px-2 py-0.5 border border-border rounded-sm hover:bg-muted"
          >
            change website_events
          </button>
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
                  title="Doors-Zeit entfernen"
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
            <option value="">No entry info</option>
            <option value="Free">Free</option>
            <option value="Pay what you want">Pay what you want</option>
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
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly_by_weekday">Monthly (by weekday)</option>
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
                  onClick={onReject}
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

      {isApproved && (onDeleteApproved || onCancelOccurrence || (canEdit && isDirty)) && (
        <div className="flex items-center justify-between gap-2 flex-shrink-0">
          {(onDeleteApproved || onCancelOccurrence) ? (
            <div className="flex gap-2">
              {onCancelOccurrence && (
                <button
                  onClick={onCancelOccurrence}
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
                  title="Delete this event from the site"
                  className="inline-flex items-center gap-1 h-8 px-3 border border-destructive/40 text-destructive rounded-sm text-xs font-medium hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              )}
            </div>
          ) : (
            <span />
          )}
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
      )}
    </div>
  );
}

function StagedEventPreview({ staged }: { staged: StagedEvent }) {
  // Synthesize a BarlinEvent-shaped object from the staged row so we can reuse
  // the same EventDetailView the public /event/:id page renders. The only
  // intentional difference vs. the live page is the disabled Interested
  // button + hidden Share menu (admin can't act-as-user from preview).
  const handleMaps = () => {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(staged.venueAddress || staged.venueName)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  // Future-only occurrences for the live preview. Two sources:
  //   • Approved rows: real sibling rows from `events`, attached by
  //     fetchApprovedEvents (recurrence_until isn't stored post-approval).
  //   • Pending staging rows: derive from recurrence + recurrenceUntil.
  const today = new Date();
  today.setHours(6, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];
  const siblingDates: string[] = (() => {
    if (staged.approvedSiblingDates) {
      return staged.approvedSiblingDates.filter(d => d >= todayStr);
    }
    if (!staged.date || !staged.recurrence || !staged.recurrenceUntil) return [];
    try {
      return generateOccurrences(staged.date, staged.recurrence as RecurrenceFreq, staged.recurrenceUntil)
        .filter(d => d >= todayStr);
    } catch {
      return [];
    }
  })();

  const event = {
    id: staged.id,
    title: staged.title,
    venue: staged.venueName,
    address: staged.venueAddress,
    neighborhood: staged.venueNeighborhood,
    date: staged.date,
    startTime: staged.startTime ?? "",
    endTime: staged.endTime ?? undefined,
    doorsTime: staged.doorsTime ?? undefined,
    category: staged.category ?? "",
    language: staged.language,
    description: staged.description,
    entryInfo: staged.entryInfo,
    url: staged.sourceUrl ?? "",
    image: undefined,
    imagePosition: "50% 50%",
    status: staged.status,
  };

  return (
    <div className="border border-border rounded-sm overflow-hidden">
      <EventDetailView
        event={event}
        siblingDates={siblingDates}
        recurrenceLabel={formatRecurrenceLabel(staged.recurrence)}
        interestedCount={staged.interestedCount ?? 0}
        // Admins always see the count for moderation context, regardless of
        // SHOW_INTEREST_COUNT (which gates the public-facing display).
        showInterestCount
        saved={false}
        isSaving={false}
        onOpenMaps={handleMaps}
        showShare={false}
        compact
        headerBanner={
          <div className="px-3 py-1.5 bg-muted/60 border-b border-border text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Live preview
          </div>
        }
      />
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
  onVenueWebsiteEventsChange,
  onMoveToRecurring,
  onSaveApproved,
  onDeleteApproved,
  onCancelOccurrence,
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
  scope: "scraped" | "manual" | "recurring";
  onApprove: (s: StagedEvent, edits: StagedEventEdits) => Promise<void>;
  onReject: (s: StagedEvent) => Promise<void>;
  onCancel?: (s: StagedEvent) => Promise<void>;
  onDuplicate: (s: StagedEvent, edits: StagedEventEdits, scope: "scraped" | "manual" | "recurring") => Promise<void>;
  onVenueChange: (id: string, venueId: string) => Promise<void>;
  onSourceUrlChange: (id: string, url: string) => Promise<void>;
  onVenueWebsiteEventsChange: (venueId: string, value: string | null) => Promise<void>;
  onMoveToRecurring?: (s: StagedEvent) => Promise<void>;
  onSaveApproved: (s: StagedEvent, edits: StagedEventEdits) => Promise<void>;
  onDeleteApproved?: (s: StagedEvent) => Promise<void>;
  onCancelOccurrence?: (s: StagedEvent) => Promise<void>;
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
              onDuplicate={(edits) => onDuplicate(staged, edits, scope)}
              onVenueChange={(venueId) => onVenueChange(staged.id, venueId)}
              onSourceUrlChange={(url) => onSourceUrlChange(staged.id, url)}
              onVenueWebsiteEventsChange={onVenueWebsiteEventsChange}
              onMoveToRecurring={onMoveToRecurring ? () => onMoveToRecurring(staged) : undefined}
              onSaveApproved={(edits) => onSaveApproved(staged, edits)}
              onDeleteApproved={onDeleteApproved ? () => onDeleteApproved(staged) : undefined}
              onCancelOccurrence={onCancelOccurrence ? () => onCancelOccurrence(staged) : undefined}
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
