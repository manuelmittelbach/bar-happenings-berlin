import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  cancelEvent,
  cancelEventSeries,
  deleteApprovedEvent,
  deleteUserStagedSubmission,
  fetchEventById,
  fetchMyStagedSubmissionById,
  updateEvent,
  updateEventSeries,
  updateUserStagedSubmission,
  uploadEventImage,
} from "@/lib/supabaseQueries";
import { hasEventStarted } from "@/lib/eventStatus";
import { editorReturnTo } from "@/lib/roleNav";
import { berlinDateString, berlinDateStringOffset } from "@/lib/dateFormat";
import EventForm, { type EventFormData } from "@/components/events/EventForm";
import { PageSpinner } from "@/components/ui/page-spinner";

export default function EditEvent() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const scopeParam = searchParams.get("scope");
  const fromParam = searchParams.get("from");
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, role, loading: authLoading, roleResolved } = useAuth();
  const isAdmin = role === "admin";

  // Where Cancel lands when there's no in-app history to pop (deep link /
  // fresh load / opened in a new tab). Derived from the `?from=` source the
  // entry point tagged the URL with — NOT the live role. The live-role branch
  // used to mis-route admins to "/profile/events" during the brief window
  // before `roleResolved` flips (see roleNav.ts).
  const cancelFallback = editorReturnTo(fromParam, id);

  // Cancel = step back to where they came from. Going back (rather than
  // pushing/replacing the /profile/events URL) avoids stranding a duplicate
  // entry that makes the first browser-back press a no-op. `location.key ===
  // "default"` means this was the first page loaded, so there's nothing to
  // pop — fall back.
  const handleCancel = () => {
    if (location.key !== "default") navigate(-1);
    else navigate(cancelFallback, { replace: true });
  };

  const [notFound, setNotFound] = useState(false);
  const [initialValues, setInitialValues] = useState<Partial<EventFormData> | null>(null);
  const [initialImageUrl, setInitialImageUrl] = useState<string | null>(null);
  const [seriesInfo, setSeriesInfo] = useState<{ isSeries: boolean; seriesId: string; eventDate: string } | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  // Which table this row lives in. Staging = the user's own pending submission
  // (no /event/:id route until approved); events = the live moderation-passed
  // row. Set on load, drives save destination and which footer actions show.
  const [source, setSource] = useState<"events" | "staging" | null>(null);

  // applyToSeries only makes sense for live events with materialized children.
  // A staging row is a single template; the rule lives on the one row.
  const applyToSeries = source === "events" && seriesInfo?.isSeries && scopeParam === "future";

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/signin", { replace: true });
      return;
    }
    if (!roleResolved) return;
    // Any signed-in role may reach the editor; the loader below still
    // restricts non-admins to events they created (event.createdBy === user.id).
    if (role !== "user" && role !== "organizer" && role !== "admin") {
      navigate("/", { replace: true });
    }
  }, [authLoading, user, role, roleResolved, navigate]);

  useEffect(() => {
    if (!id || authLoading || !user || !roleResolved) return;
    const load = async () => {
      // Try the live `events` table first (the common case). Fall back to the
      // user's own staging row for pending submissions — admins skip the
      // fallback since their staging review path is the AdminDashboard, not
      // this editor.
      let loadedSource: "events" | "staging" = "events";
      let event = await fetchEventById(id);
      if (!event && !isAdmin) {
        event = await fetchMyStagedSubmissionById(id, user.id);
        if (event) loadedSource = "staging";
      }
      if (!event || (!isAdmin && event.createdBy !== user.id)) {
        setNotFound(true);
        return;
      }
      if (!isAdmin && (event.status === "canceled" || hasEventStarted(event))) {
        navigate("/profile/events", { replace: true });
        return;
      }
      setSource(loadedSource);
      setInitialValues({
        title: event.title,
        venue: event.venue,
        address: event.address,
        neighborhood: event.neighborhood,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime ?? "",
        doorsTime: event.doorsTime ?? "",
        category: event.category,
        description: event.description,
        entryInfo: event.entryInfo || "",
        language: event.language || "",
        website: event.url ?? "",
        imagePosition: event.imagePosition,
        recurrence: "",
        recurrenceUntil: "",
      });
      setInitialImageUrl(event.image ?? null);
      setVenueId(event.venueId || null);
      const isSeries = !!event.recurrence || !!event.parentId;
      setSeriesInfo({
        isSeries,
        seriesId: event.parentId || event.id,
        eventDate: event.date,
      });
    };
    void load();
  }, [id, user, authLoading, role, roleResolved, isAdmin, navigate]);

  const handleSubmit = useMemo(
    () => async (data: EventFormData, image: { file: File | null; changed: boolean }) => {
      if (!id || !user || !seriesInfo || !source) return;
      try {
        let imageUrl: string | null | undefined;
        if (image.changed) {
          imageUrl = image.file ? await uploadEventImage(image.file, user.id) : null;
        }
        const dataWithVenueId = { ...data, venueId: venueId ?? undefined };
        if (source === "staging") {
          const { updated } = await updateUserStagedSubmission(id, dataWithVenueId, imageUrl);
          if (!updated) {
            // Admin approved the row between load and save — it moved into the
            // `events` table under a new id. Send them back to "Manage your
            // events" where the now-live event is reachable.
            toast.info("This event was just approved. Reload to edit the live version.");
            navigate("/profile/events", { replace: true });
            return;
          }
          toast.success("Submission updated!");
          if (location.key !== "default") navigate(-1);
          else navigate("/profile/events", { replace: true });
          return;
        }
        if (applyToSeries) {
          await updateEventSeries(seriesInfo.seriesId, seriesInfo.eventDate, dataWithVenueId, imageUrl);
          toast.success("Series updated!");
        } else {
          await updateEvent(id, dataWithVenueId, imageUrl);
          toast.success("Event updated!");
        }
        // refetchType: "all" refetches the (inactive) event lists now instead of
        // lazily on next mount, so the change is reflected before we navigate.
        await queryClient.invalidateQueries({ queryKey: ["events"], refetchType: "all" });
        queryClient.invalidateQueries({ queryKey: ["event", id] });
        // Mirror Cancel exactly: step back to wherever the editor was opened
        // from — the admin recurring/approved list, the event detail, "Your
        // events" — so Save and Cancel always land in the same spot. navigate(-1)
        // is a POP, so the ScrollManager also restores the saved scroll position
        // there. Deep-load (no in-app history) falls back by `?from=` source.
        if (location.key !== "default") {
          navigate(-1);
        } else {
          navigate(cancelFallback, { replace: true });
        }
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    },
    [navigate, cancelFallback, id, user, seriesInfo, applyToSeries, queryClient, venueId, source, location.key],
  );

  const handleDelete = async () => {
    if (!id || !seriesInfo) return;
    const today = berlinDateString();
    const tomorrow = berlinDateStringOffset(1);
    const staysVisible = seriesInfo.eventDate === today || seriesInfo.eventDate === tomorrow;
    const confirmMessage = applyToSeries
      ? staysVisible
        ? "Cancel this series? The next upcoming event stays visible as canceled; all later events will be removed. This cannot be undone."
        : "Cancel this series? All events will be removed from the listings. This cannot be undone."
      : staysVisible
        ? "Cancel this event? This action cannot be undone. The event will be marked as canceled and stay visible."
        : "Cancel this event? This action cannot be undone. The event will be removed from the listings.";
    if (!window.confirm(confirmMessage)) return;
    try {
      const by = isAdmin ? "admin" : "organizer";
      if (applyToSeries) {
        await cancelEventSeries(seriesInfo.seriesId, seriesInfo.eventDate, by);
        toast.success("Series marked as canceled.");
      } else {
        await cancelEvent(id, by);
        toast.success("Event marked as canceled.");
      }
      // refetchType: "all" refetches the (inactive) event lists now instead of
      // lazily on next mount, so the change is reflected before we navigate.
      await queryClient.invalidateQueries({ queryKey: ["events"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["event", id] });
      if (isAdmin) {
        // Event still exists (now canceled) but the editor is stale. Replace
        // the editor entry with the source view so the back button doesn't
        // re-open the editor of a canceled event.
        navigate(cancelFallback, { replace: true });
      } else if (location.key !== "default") {
        navigate(-1);
      } else {
        navigate("/profile/events", { replace: true });
      }
    } catch {
      toast.error("Couldn't cancel the event. Please try again.");
    }
  };

  const handleWithdraw = async () => {
    if (!id) return;
    if (!window.confirm("Withdraw this submission? It will be permanently removed and won't be reviewed.")) return;
    try {
      const { withdrawn } = await deleteUserStagedSubmission(id);
      if (!withdrawn) {
        toast.info("This event was just approved by an admin and can't be withdrawn anymore.");
      } else {
        toast.success("Submission withdrawn.");
      }
      // Refresh the cached lists so the withdrawn row drops out of "Manage
      // your events" (key ["events","by-creator",…]) instead of lingering.
      // refetchType: "all" refetches the (inactive) event lists now instead of
      // lazily on next mount, so the change is reflected before we navigate.
      await queryClient.invalidateQueries({ queryKey: ["events"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["event", id] });
      if (location.key !== "default") navigate(-1);
      else navigate("/profile/events", { replace: true });
    } catch {
      toast.error("Couldn't withdraw the submission. Please try again.");
    }
  };

  const handleHardDelete = async () => {
    if (!id || !seriesInfo) return;
    const seriesId = seriesInfo.isSeries ? seriesInfo.seriesId : null;
    const confirmMsg = seriesId
      ? `Delete this event and ALL occurrences in this series? This permanently removes them from the site.`
      : `Delete this event? This permanently removes it from the site.`;
    if (!window.confirm(confirmMsg)) return;
    try {
      await deleteApprovedEvent(id, seriesId);
      // refetchType: "all" refetches the (inactive) event lists now instead of
      // lazily on next mount, so the change is reflected before we navigate.
      await queryClient.invalidateQueries({ queryKey: ["events"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["event", id] });
      toast.success(seriesId ? "Series deleted" : "Event deleted");
      // The event is gone for good — never route back to /event/:id (would be
      // Not Found). Drop the `id` so an `from=event` source degrades to the
      // events list, and replace so the dead editor isn't in the back history.
      navigate(editorReturnTo(fromParam), { replace: true });
    } catch {
      toast.error("Couldn't delete the event. Please try again.");
    }
  };

  if (notFound) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">
          Event not found or you don't have permission to edit it.
        </p>
      </div>
    );
  }

  if (!initialValues || !seriesInfo || !source) {
    return <PageSpinner />;
  }

  const isStaging = source === "staging";
  const subtitle = isStaging
    ? "This event is awaiting admin review. Changes apply to your pending submission."
    : applyToSeries
    ? "Changes will apply to all upcoming events in this series."
    : seriesInfo.isSeries
    ? "Changes will apply to this event only."
    : "Changes are saved directly.";

  return (
    <>
      {/* Sticky Back row for user/organizer (same affordance as View / Publish)
          so they have a clear way back to their account. Admins navigate via
          the admin dashboard, so they don't get it here. */}
      {!isAdmin && (
        <div className="sticky z-40 bg-background" style={{ top: 0 }}>
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
      )}
      <EventForm
      title={applyToSeries ? "Edit Series" : "Edit Event"}
      subtitle={subtitle}
      initialValues={initialValues}
      initialImageUrl={initialImageUrl}
      submitLabel={applyToSeries ? "Save Series" : "Save Changes"}
      submittingLabel="Saving…"
      onSubmit={handleSubmit}
      recurrenceLocked={seriesInfo.isSeries}
      optionalStartTime={isAdmin}
      optionalEndTime={isAdmin}
      optionalDescription={isAdmin}
      optionalEntryInfo={isAdmin}
      secondaryActions={
        <button
          type="button"
          onClick={handleCancel}
          className="h-12 px-6 flex items-center border border-border text-sm font-medium hover:bg-muted transition-colors"
        >
          Cancel
        </button>
      }
      footer={
        isStaging ? (
        <div className="relative z-10 pt-6 border-t border-border flex flex-col gap-3">
          <button
            type="button"
            onClick={handleWithdraw}
            style={{ touchAction: "manipulation" }}
            className="w-full h-12 bg-background border border-accent text-accent text-sm font-semibold cursor-pointer hover:opacity-70 transition-opacity"
          >
            Withdraw submission
          </button>
        </div>
        ) : (
        <div className="relative z-10 pt-6 border-t border-border flex flex-col gap-3">
          <button
            type="button"
            onClick={handleDelete}
            style={{ touchAction: "manipulation" }}
            className="w-full h-12 bg-background border border-accent text-accent text-sm font-semibold cursor-pointer hover:opacity-70 transition-opacity"
          >
            {applyToSeries ? "Cancel Series" : "Cancel Event"}
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={handleHardDelete}
              style={{ touchAction: "manipulation" }}
              className="w-full h-12 bg-background border border-red-600 text-red-600 text-sm font-semibold cursor-pointer hover:opacity-70 transition-opacity"
            >
              {seriesInfo.isSeries ? "Delete Series" : "Delete Event"}
            </button>
          )}
        </div>
        )
      }
      />
    </>
  );
}
