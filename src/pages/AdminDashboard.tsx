import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Edit, Trash2, Check, X, Users, CalendarDays, Building2, BarChart3, Shield } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { events, venues } from "@/data/mockData";
import { toast } from "sonner";

const adminStats = [
  { label: "Total Events", value: "48", icon: CalendarDays },
  { label: "Active Venues", value: "14", icon: Building2 },
  { label: "Total Interest", value: "1.8K", icon: Users },
  { label: "This Week", value: "12", icon: BarChart3 },
];

const pendingEvents = [
  { id: "p1", title: "Karaoke Night at Sputnik Bar", venue: "Sputnik Bar", neighborhood: "Friedrichshain", date: "2026-04-05", status: "pending" },
  { id: "p2", title: "Salsa Social at El Barrio", venue: "El Barrio", neighborhood: "Kreuzberg", date: "2026-04-06", status: "pending" },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"overview" | "events" | "venues" | "pending">("overview");

  const handleApprove = (title: string) => toast.success(`"${title}" approved`);
  const handleReject = (title: string) => toast.error(`"${title}" rejected`);
  const handleDelete = (title: string) => toast.success(`"${title}" deleted`);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container py-8">
          <div className="flex items-center gap-2 mb-8">
            <Shield className="h-5 w-5 text-accent" />
            <h1 className="heading-display text-3xl">Admin Dashboard</h1>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {adminStats.map((stat) => (
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
          <div className="flex gap-4 border-b border-border mb-6 overflow-x-auto">
            {(["overview", "events", "venues", "pending"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  activeTab === tab ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "pending" ? `Pending (${pendingEvents.length})` : tab}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <div className="space-y-6">
              <div>
                <h3 className="font-heading text-lg font-semibold mb-3">Recent Activity</h3>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">• <span className="text-foreground font-medium">Kastanienbar</span> published "Acoustic Sessions" — <span className="text-xs">2 hours ago</span></p>
                  <p className="text-muted-foreground">• <span className="text-foreground font-medium">Sputnik Bar</span> submitted "Karaoke Night" for review — <span className="text-xs">5 hours ago</span></p>
                  <p className="text-muted-foreground">• New venue <span className="text-foreground font-medium">El Barrio</span> registered — <span className="text-xs">1 day ago</span></p>
                  <p className="text-muted-foreground">• <span className="text-foreground font-medium">Trinkhalle</span> edited "Open Mic: Anything Goes" — <span className="text-xs">1 day ago</span></p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "events" && (
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="border border-border rounded-sm p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <Link to={`/event/${event.id}`} className="font-heading text-sm font-semibold hover:text-accent transition-colors">
                      {event.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{event.venue} · {event.neighborhood} · {event.date}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Link to={`/event/${event.id}`} className="p-1.5 hover:bg-muted rounded-sm"><Eye className="h-4 w-4 text-muted-foreground" /></Link>
                    <button className="p-1.5 hover:bg-muted rounded-sm"><Edit className="h-4 w-4 text-muted-foreground" /></button>
                    <button onClick={() => handleDelete(event.title)} className="p-1.5 hover:bg-muted rounded-sm"><Trash2 className="h-4 w-4 text-muted-foreground" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "venues" && (
            <div className="space-y-3">
              {venues.map((venue) => (
                <div key={venue.id} className="border border-border rounded-sm p-4 flex gap-4 items-center">
                  <div className="w-12 h-12 rounded-sm overflow-hidden flex-shrink-0 bg-muted">
                    <img src={venue.image} alt={venue.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading text-sm font-semibold">{venue.name}</p>
                    <p className="text-xs text-muted-foreground">{venue.neighborhood} · {venue.address}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-accent/10 text-accent rounded-sm font-medium">Active</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "pending" && (
            <div className="space-y-3">
              {pendingEvents.map((event) => (
                <div key={event.id} className="border border-border rounded-sm p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-heading text-sm font-semibold">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.venue} · {event.neighborhood} · {event.date}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(event.title)}
                      className="inline-flex items-center gap-1 h-8 px-3 bg-foreground text-background rounded-sm text-xs font-medium"
                    >
                      <Check className="h-3 w-3" /> Approve
                    </button>
                    <button
                      onClick={() => handleReject(event.title)}
                      className="inline-flex items-center gap-1 h-8 px-3 border border-border rounded-sm text-xs font-medium hover:bg-muted"
                    >
                      <X className="h-3 w-3" /> Reject
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
