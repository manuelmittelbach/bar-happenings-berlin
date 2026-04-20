import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Calendar, Clock, MapPin, Tag } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { categories, neighborhoods } from "@/data/mockData";
import { toast } from "sonner";

export default function PublishEvent() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: "", venue: "", address: "", neighborhood: "", date: "",
    startTime: "", endTime: "", category: "", description: "",
    entryInfo: "Free Entry", language: "English", tags: "",
    instagram: "", website: "", capacity: "",
  });

  const update = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Event published!", { description: "Your event is now live on Inside Bars." });
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container max-w-2xl py-8">
<h1 className="heading-display text-3xl mb-2">Publish an Event</h1>
          <p className="text-muted-foreground text-sm mb-8">
            Share your bar event with Berlin. It takes less than 5 minutes.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Cover image */}
            <div className="border-2 border-dashed border-border rounded-sm p-8 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Upload cover image</p>
              <p className="text-xs text-muted-foreground mt-1">JPG or PNG, max 5MB</p>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Event title *</label>
              <input
                type="text" required value={formData.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. Acoustic Sessions: Strings & Things"
                className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
              />
            </div>

            {/* Venue */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Venue name *</label>
                <input
                  type="text" required value={formData.venue}
                  onChange={(e) => update("venue", e.target.value)}
                  placeholder="e.g. Kastanienbar"
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
                placeholder="e.g. Weserstr. 42, 12045 Berlin"
                className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
              />
            </div>

            {/* Date & Time */}
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

            {/* Category */}
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
                <label className="text-sm font-medium">Entry info *</label>
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

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description *</label>
              <textarea
                required value={formData.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Tell people what to expect..."
                rows={6}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors resize-none"
              />
            </div>

            {/* Extra */}
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
                <label className="text-sm font-medium">Capacity</label>
                <input
                  type="text" value={formData.capacity}
                  onChange={(e) => update("capacity", e.target.value)}
                  placeholder="e.g. 40 people"
                  className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Instagram</label>
                <input
                  type="text" value={formData.instagram}
                  onChange={(e) => update("instagram", e.target.value)}
                  placeholder="@yourvenue"
                  className="w-full h-10 px-3 bg-muted/50 border border-border rounded-sm text-sm outline-none focus:border-foreground transition-colors"
                />
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
              <button type="submit" className="flex-1 h-12 bg-foreground text-background rounded-sm text-sm font-semibold hover:bg-foreground/90 transition-colors">
                Publish Event
              </button>
              <button type="button" className="h-12 px-6 border border-border rounded-sm text-sm font-medium hover:bg-muted transition-colors">
                Save Draft
              </button>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
