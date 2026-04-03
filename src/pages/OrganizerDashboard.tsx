import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Eye, Edit, Trash2, MessageCircle, Users, CalendarDays, BarChart3 } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { events } from "@/data/mockData";
import { toast } from "sonner";

const myEvents = events.slice(0, 4);

const stats = [
  { label: "Published Events", value: "12", icon: CalendarDays },
  { label: "Total Interested", value: "284", icon: Users },
  { label: "Questions", value: "18", icon: MessageCircle },
  { label: "Profile Views", value: "1.2K", icon: BarChart3 },
];

export default function OrganizerDashboard() {
  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "drafts">("upcoming");

  const handleDelete = (title: string) => {
    toast.success(`"${title}" deleted`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container py-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="heading-display text-3xl">Your Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">Kastanienbar · Neukölln</p>
            </div>
            <Link
              to="/publish"
              className="inline-flex items-center gap-2 h-10 px-5 bg-foreground text-background rounded-sm text-sm font-medium hover:bg-foreground/90 transition-colors"
            >
              <Plus className="h-4 w-4" /> New Event
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {stats.map((stat) => (
              <div key={stat.label} className="border border-border rounded-sm p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="font-heading text-2xl font-bold">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-4 border-b border-border mb-6">
            {(["upcoming", "past", "drafts"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                  activeTab === tab ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Events list */}
          {activeTab === "drafts" ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-sm">No drafts yet</p>
              <Link to="/publish" className="text-sm text-accent mt-2 inline-block">Create an event →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {myEvents.map((event) => (
                <div key={event.id} className="border border-border rounded-sm p-4 flex flex-col sm:flex-row gap-4">
                  <div className="w-full sm:w-24 h-20 rounded-sm overflow-hidden flex-shrink-0 bg-muted">
                    <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link to={`/event/${event.id}`} className="font-heading text-sm font-semibold hover:text-accent transition-colors">
                      {event.title}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDateWithDay(event.date)} · {event.startTime} – {event.endTime} · {event.neighborhood}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {event.interestedCount} interested</span>
                      <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> 3 questions</span>
                    </div>
                  </div>
                  <div className="flex sm:flex-col gap-2 sm:items-end justify-end flex-shrink-0">
                    <Link to={`/event/${event.id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <Eye className="h-3 w-3" /> View
                    </Link>
                    <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <Edit className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(event.title)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
