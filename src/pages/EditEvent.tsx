import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Calendar, Clock, MapPin, Tag } from "lucide-react";
import { categories } from "@/data/categories";
import { neighborhoods } from "@/data/neighborhoods";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { fetchEventById, updateEvent } from "@/lib/supabaseQueries";

export default function EditEvent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  const isAdmin = role === "admin";
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [formData, setFormData] = useState({
    title: "", venue: "", address: "", neighborhood: "", date: "",
    startTime: "", endTime: "", category: "", description: "",
    entryInfo: "Free Entry", language: "English", tags: "",
    instagram: "", website: "",
  });

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
      if (!event || (!isAdmin && event.createdBy !== user.id)) { setNotFound(true); return; }
      setFormData({
        title: event.title,
        venue: event.venue,
        address: event.address,
        neighborhood: event.neighborhood,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime ?? "",
        category: event.category,
        description: event.description,
        entryInfo: event.entryInfo || "Free Entry",
        language: event.language || "English",
        tags: event.tags?.join(", ") ?? "",
        instagram: "",
        website: event.url ?? "",
      });
    });
  }, [id, user, authLoading, role, isAdmin]);

  const update = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSubmitting(true);
    try {
      await updateEvent(id, formData);
      toast.success("Event updated!");
      navigate(isAdmin ? "/admin" : "/dashboard");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (notFound) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Event not found or you don't have permission to edit it.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
          <h1 className="heading-display text-3xl mb-2">Edit Event</h1>
          <p className="text-muted-foreground text-sm mb-8">Changes are saved directly.</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Event title *</label>
              <input
                type="text" required value={formData.title}
                onChange={(e) => update("title", e.target.value)}
                className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Venue name *</label>
                <input
                  type="text" required value={formData.venue}
                  onChange={(e) => update("venue", e.target.value)}
                  className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1"><MapPin className="h-3 w-3" /> Neighborhood *</label>
                <select
                  required value={formData.neighborhood}
                  onChange={(e) => update("neighborhood", e.target.value)}
                  className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                >
                  <option value="">Select district</option>
                  {neighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Address *</label>
              <input
                type="text" required value={formData.address}
                onChange={(e) => update("address", e.target.value)}
                className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1"><Calendar className="h-3 w-3" /> Date *</label>
                <input
                  type="date" required value={formData.date}
                  onChange={(e) => update("date", e.target.value)}
                  className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1"><Clock className="h-3 w-3" /> Start *</label>
                <input
                  type="time" required value={formData.startTime}
                  onChange={(e) => update("startTime", e.target.value)}
                  className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1"><Clock className="h-3 w-3" /> End</label>
                <input
                  type="time" value={formData.endTime}
                  onChange={(e) => update("endTime", e.target.value)}
                  className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1"><Tag className="h-3 w-3" /> Category *</label>
                <select
                  required value={formData.category}
                  onChange={(e) => update("category", e.target.value)}
                  className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                >
                  <option value="">Select category</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Entry info</label>
                <select
                  value={formData.entryInfo}
                  onChange={(e) => update("entryInfo", e.target.value)}
                  className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                >
                  <option>Free Entry</option>
                  <option>Pay at Venue</option>
                  <option>Suggested Donation</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description *</label>
              <textarea
                required value={formData.description}
                onChange={(e) => update("description", e.target.value)}
                rows={6}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Language</label>
                <select
                  value={formData.language}
                  onChange={(e) => update("language", e.target.value)}
                  className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                >
                  <option>English</option>
                  <option>German</option>
                  <option>English / German</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Website</label>
                <input
                  type="url" value={formData.website}
                  onChange={(e) => update("website", e.target.value)}
                  placeholder="https://"
                  className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tags</label>
              <input
                type="text" value={formData.tags}
                onChange={(e) => update("tags", e.target.value)}
                placeholder="e.g. live music, acoustic, free entry"
                className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
              />
              <p className="text-xs text-muted-foreground">Comma-separated</p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 h-12 bg-foreground text-background rounded-sm text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Save Changes"}
              </button>
              <Link
                to={isAdmin ? "/admin" : "/dashboard"}
                className="h-12 px-6 flex items-center border border-border rounded-sm text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
    </div>
  );
}
