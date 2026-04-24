import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { List } from "lucide-react";
import { categories } from "@/data/categories";
import { useEvents, useVenues } from "@/hooks/useEvents";
import { useUserLocation } from "@/hooks/useUserLocation";
import { CategoryIconBar, CategoryIconRow } from "@/components/events/CategoryPill";
import EventMap from "@/components/map/EventMap";
import { isEventStillOnline } from "@/lib/eventStatus";

const dateFilters = ["All", "Today", "Tomorrow"];

export default function MapPage() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("");
  const [activeDate, setActiveDate] = useState("All");

  const { data: eventsData = [] } = useEvents();
  const { data: venuesData = [] } = useVenues();
  const { location: userLocation } = useUserLocation();

  const venueMap = useMemo(
    () => Object.fromEntries(venuesData.map((v) => [v.id, v])),
    [venuesData]
  );

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const filtered = useMemo(() => {
    let result = [...eventsData];
    result = result.filter((e) => isEventStillOnline(e));
    if (activeCategory) result = result.filter((e) => e.category === activeCategory);
    if (activeDate === "Today") result = result.filter((e) => e.date === today);
    if (activeDate === "Tomorrow") result = result.filter((e) => e.date === tomorrow);
    return result;
  }, [eventsData, activeCategory, activeDate, today, tomorrow]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Filters bar */}
      <div className="shrink-0 bg-background border-b-2 border-foreground z-[50]">
        {/* Date filters */}
        <div className="border-b border-border overflow-x-auto scrollbar-hide"><div className="container flex gap-2 py-2.5">
          {dateFilters.map((d) => (
            <button
              key={d}
              onClick={() => setActiveDate(d)}
              className={`shrink-0 inline-flex items-center justify-center px-4 py-2 font-mono text-[10px] md:text-xs uppercase tracking-wider border-2 transition-all ${
                activeDate === d
                  ? "border-foreground bg-foreground text-background"
                  : "border-foreground hover:bg-foreground hover:text-background"
              }`}
            >
              {d}
            </button>
          ))}
        </div></div>

        {/* Category filters */}
        <div className="container py-3">
          <div className="md:hidden">
            <CategoryIconBar
              categories={categories}
              activeCategory={activeCategory}
              onSelect={setActiveCategory}
            />
          </div>
          <div className="hidden md:block">
            <CategoryIconRow
              categories={categories}
              activeCategory={activeCategory}
              onSelect={setActiveCategory}
            />
          </div>
        </div>
      </div>

      {/* Map fills remaining height */}
      <div className="flex-1 min-h-0 relative">
        <div className="absolute top-2 right-2 z-[9999] bg-black/70 text-white text-xs px-2 py-1 font-mono pointer-events-none">
          {filtered.length} events
        </div>
        <EventMap
          events={filtered}
          venueMap={venueMap}
          userLocation={userLocation}
          onEventClick={(id) => navigate(`/event/${id}`)}
        />
      </div>

      {/* List button — same style as Map button on main page */}
      <button
        onClick={() => navigate("/")}
        className="fixed bottom-6 right-0 z-[9999] flex items-center gap-2 h-12 pl-5 pr-4 bg-accent text-accent-foreground font-mono font-bold text-xs uppercase tracking-wider shadow-lg hover:bg-accent/90 transition-all rounded-l-full border-2 border-r-0 border-accent"
      >
        <List className="h-4 w-4" />
        List
      </button>
    </div>
  );
}
