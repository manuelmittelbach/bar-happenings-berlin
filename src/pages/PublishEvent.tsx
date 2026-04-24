import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Clock3, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { createEvent, fetchOrganizerById, uploadEventImage } from "@/lib/supabaseQueries";
import EventForm, { type EventFormData } from "@/components/events/EventForm";

export default function PublishEvent() {
  const navigate = useNavigate();
  const { user, role, approvalStatus, loading } = useAuth();
  const [venuePrefill, setVenuePrefill] = useState<Partial<EventFormData>>({});

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login", { replace: true, state: { from: "/publish" } });
      return;
    }
    if (role !== "organizer" && role !== "admin") {
      navigate("/", { replace: true });
    }
  }, [loading, user, role, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchOrganizerById(user.id).then((organizer) => {
      const v = organizer?.venue;
      if (!v) return;
      setVenuePrefill({
        venue: v.name ?? "",
        address: v.address ?? "",
        neighborhood: v.neighborhood ?? "",
      });
    });
  }, [user]);

  const handleSubmit = useMemo(
    () => async (data: EventFormData, image: { file: File | null }) => {
      if (!user) return;
      try {
        const imageUrl = image.file ? await uploadEventImage(image.file, user.id) : undefined;
        await createEvent(data, user.id, imageUrl);
        toast.success("Event published!", { description: "Your event is now live on Inside Bars." });
        navigate("/dashboard");
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    },
    [user, navigate]
  );

  if (loading || !user || (role !== "organizer" && role !== "admin")) return null;

  if (role === "organizer" && approvalStatus !== "approved") {
    const rejected = approvalStatus === "rejected";
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="w-full max-w-md mx-auto px-4 text-center space-y-5">
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
              ? "Your bar account application was not approved, so you can't publish events. If you think this is a mistake, please contact us."
              : "An admin needs to review your bar details before you can publish events. You'll be able to publish as soon as your account is approved."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <EventForm
      title="Publish an Event"
      subtitle="Once published, it appears directly on the front page."
      initialValues={venuePrefill}
      submitLabel="Publish Event"
      onSubmit={handleSubmit}
      secondaryActions={
        <Link
          to="/dashboard"
          className="h-12 px-6 flex items-center border border-border rounded-sm text-sm font-medium hover:bg-muted transition-colors"
        >
          Cancel
        </Link>
      }
    />
  );
}
