import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  cancelEvent,
  cancelEventSeries,
  deleteApprovedEvent,
  fetchEventById,
  updateEvent,
  updateEventSeries,
  uploadEventImage,
} from "@/lib/supabaseQueries";
import { hasEventStarted } from "@/lib/eventStatus";
import { berlinDateString, berlinDateStringOffset } from "@/lib/dateFormat";
import EventForm, { type EventFormData } from "@/components/events/EventForm";
import { Spinner } from "@/components/ui/spinner";

export default function EditEvent() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const scopeParam = searchParams.get("scope");
  const fromParam = searchParams.get("from");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, role, loading: authLoading, roleResolved } = useAuth();
  const isAdmin = role === "admin";

  const [notFound, setNotFound] = useState(false);
  const [initialValues, setInitialValues] = useState<Partial<EventFormData> | null>(null);
  const [initialImageUrl, setInitialImageUrl] = useState<string | null>(null);
  const [seriesInfo, setSeriesInfo] = useState<{ isSeries: boolean; seriesId: string; eventDate: string } | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);

  const applyToSeries = seriesInfo?.isSeries && scopeParam === "future";

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/for-bars", { replace: true });
      return;
    }
    if (!roleResolved) return;
    if (role !== "organizer" && role !== "admin") {
      navigate("/", { replace: true });
    }
  }, [authLoading, user, role, roleResolved, navigate]);

  useEffect(() => {
    if (!id || authLoading || !user || !roleResolved) return;
    fetchEventById(id).then((event) => {
      if (!event || (!isAdmin && event.createdBy !== user.id)) {
        setNotFound(true);
        return;
      }
      if (event.status === "canceled" || hasEventStarted(event)) {
        navigate(isAdmin ? "/admin" : "/dashboard", { replace: true });
        return;
      }
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
    });
  }, [id, user, authLoading, role, roleResolved, isAdmin, navigate]);

  const handleSubmit = useMemo(
    () => async (data: EventFormData, image: { file: File | null; changed: boolean }) => {
      if (!id || !user || !seriesInfo) return;
      try {
        let imageUrl: string | null | undefined;
        if (image.changed) {
          imageUrl = image.file ? await uploadEventImage(image.file, user.id) : null;
        }
        const dataWithVenueId = { ...data, venueId: venueId ?? undefined };
        if (applyToSeries) {
          await updateEventSeries(seriesInfo.seriesId, seriesInfo.eventDate, dataWithVenueId, imageUrl);
          toast.success("Series updated!");
        } else {
          await updateEvent(id, dataWithVenueId, imageUrl);
          toast.success("Event updated!");
        }
        queryClient.invalidateQueries({ queryKey: ["events"] });
        queryClient.invalidateQueries({ queryKey: ["event", id] });
        navigate(isAdmin ? `/event/${id}` : "/dashboard");
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    },
    [id, user, isAdmin, navigate, seriesInfo, applyToSeries, queryClient, venueId],
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
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["event", id] });
      navigate(isAdmin ? "/" : "/dashboard");
    } catch {
      toast.error("Couldn't cancel the event. Please try again.");
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
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["event", id] });
      toast.success(seriesId ? "Series deleted" : "Event deleted");
      navigate("/");
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

  if (!initialValues || !seriesInfo) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const subtitle = applyToSeries
    ? "Changes will apply to all upcoming events in this series."
    : seriesInfo.isSeries
    ? "Changes will apply to this event only."
    : "Changes are saved directly.";

  return (
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
      optionalDescription={isAdmin}
      secondaryActions={
        <Link
          to={
            fromParam === "admin"
              ? "/admin?tab=recurring&filter=approved"
              : fromParam === "admin-all-bars"
              ? "/admin?tab=all-bars"
              : isAdmin
              ? `/event/${id}`
              : "/dashboard"
          }
          className="h-12 px-6 flex items-center border border-border rounded-sm text-sm font-medium hover:bg-muted transition-colors"
        >
          Cancel
        </Link>
      }
      footer={
        <div className="relative z-10 pt-6 border-t border-border flex flex-col gap-3">
          <button
            type="button"
            onClick={handleDelete}
            style={{ touchAction: "manipulation" }}
            className="w-full h-12 bg-background border border-accent text-accent rounded-sm text-sm font-semibold cursor-pointer hover:opacity-70 transition-opacity"
          >
            {applyToSeries ? "Cancel Series" : "Cancel Event"}
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={handleHardDelete}
              style={{ touchAction: "manipulation" }}
              className="w-full h-12 bg-background border border-red-600 text-red-600 rounded-sm text-sm font-semibold cursor-pointer hover:opacity-70 transition-opacity"
            >
              {seriesInfo.isSeries ? "Delete Series" : "Delete Event"}
            </button>
          )}
        </div>
      }
    />
  );
}
