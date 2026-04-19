import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { List } from "lucide-react";
import { categories } from "@/data/mockData";
import { useEvents, useVenues } from "@/hooks/useEvents";
import { useUserLocation } from "@/hooks/useUserLocation";
import { CategoryIconBar, CategoryIconRow } from "@/components/events/CategoryPill";
import EventMap from "@/components/map/EventMap";

const dateFilters = ["All", "Today", "Tomorrow", "This Week"];

export default function MapPage() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("");
  const [activeDate, setActiveDate] = useState("All");

  const { data: eventsData = [] } = useEvents();
  const { data: venuesData = [] } = useVenues();
  const userLocation = useUserLocation();

  const venueMap = useMemo(
    () => Object.fromEntries(venuesData.map((v) => [v.id, v])),
    [venuesData]
  );

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const isLateNight = new Date().getHours() < 6;

  const filtered = useMemo(() => {
    let result = [...eventsData];
    result = result.filter((e) => e.date >= (isLateNight ? yesterday : today));
    if (activeCategory) result = result.filter((e) => e.category === activeCategory);
    if (activeDate === "Today") result = result.filter((e) => e.date === today);
    if (activeDate === "Tomorrow") result = result.filter((e) => e.date === tomorrow);
    if (activeDate === "This Week") {
      const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
      result = result.filter((e) => e.date >= today && e.date <= weekEnd);
    }
    return result;
  }, [eventsData, activeCategory, activeDate, today, tomorrow, yesterday, isLateNight]);

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      {/* Filters bar */}
      <div className="shrink-0 bg-background border-b-2 border-foreground z-[50]">
        {/* Date filters */}
        <div className="flex gap-2 px-4 py-2.5 border-b border-border overflow-x-auto scrollbar-hide">
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
        </div>

        {/* Category filters */}
        <div className="px-4 py-2">
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
