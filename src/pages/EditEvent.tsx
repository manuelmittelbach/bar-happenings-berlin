import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchEventById,
  updateEvent,
  cancelEvent,
  uploadEventImage,
} from "@/lib/supabaseQueries";
import { hasEventStarted } from "@/lib/eventStatus";
import EventForm, { type EventFormData } from "@/components/events/EventForm";

export default function EditEvent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  const isAdmin = role === "admin";

  const [notFound, setNotFound] = useState(false);
  const [initialValues, setInitialValues] = useState<Partial<EventFormData> | null>(null);
  const [initialImageUrl, setInitialImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (role !== "organizer" && role !== "admin") {
      navigate("/", { replace: true });
    }
  }, [authLoading, user, role, navigate]);

  useEffect(() => {
    if (!id || authLoading || !user || role === null) return;
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
        category: event.category,
        description: event.description,
        entryInfo: event.entryInfo || "",
        language: event.language || "",
        website: event.url ?? "",
        imagePosition: event.imagePosition,
      });
      setInitialImageUrl(event.image ?? null);
    });
  }, [id, user, authLoading, role, isAdmin]);

  const handleSubmit = useMemo(
    () => async (data: EventFormData, image: { file: File | null; changed: boolean }) => {
      if (!id || !user) return;
      try {
        let imageUrl: string | null | undefined;
        if (image.changed) {
          imageUrl = image.file ? await uploadEventImage(image.file, user.id) : null;
        }
        await updateEvent(id, data, imageUrl);
        toast.success("Event updated!");
        navigate(isAdmin ? "/admin" : "/dashboard");
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    },
    [id, user, isAdmin, navigate]
  );

  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm("Cancel this event? This action cannot be undone. The event will be marked as canceled and stay visible.")) return;
    try {
      await cancelEvent(id);
      toast.success("Event marked as canceled.");
      navigate(isAdmin ? "/admin" : "/dashboard");
    } catch {
      toast.error("Couldn't cancel the event. Please try again.");
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

  if (!initialValues) return null;

  return (
    <EventForm
      title="Edit Event"
      subtitle="Changes are saved directly."
      initialValues={initialValues}
      initialImageUrl={initialImageUrl}
      submitLabel="Save Changes"
      submittingLabel="Saving…"
      onSubmit={handleSubmit}
      secondaryActions={
        <Link
          to={isAdmin ? "/admin" : "/dashboard"}
          className="h-12 px-6 flex items-center border border-border rounded-sm text-sm font-medium hover:bg-muted transition-colors"
        >
          Cancel
        </Link>
      }
      footer={
        <div className="pt-6 border-t border-border">
          <button
            type="button"
            onClick={handleDelete}
            className="w-full h-12 bg-background border border-accent text-accent rounded-sm text-sm font-semibold hover:opacity-70 transition-opacity"
          >
            Cancel Event
          </button>
        </div>
      }
    />
  );
}
