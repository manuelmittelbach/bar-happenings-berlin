import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { BarlinEvent } from "@/types/event";
import { venues } from "@/data/legacyVenueLookup";
import { categoryInfos } from "@/data/categories";

interface MapViewProps {
  events: BarlinEvent[];
  onEventClick?: (eventId: string) => void;
}

export default function MapView({ events, onEventClick }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [52.52, 13.405],
      zoom: 12,
      zoomControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Grayscale tiles for the B&W aesthetic
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    // Group events by venue
    const venueEvents = new Map<string, BarlinEvent[]>();
    events.forEach((event) => {
      const existing = venueEvents.get(event.venueId) || [];
      existing.push(event);
      venueEvents.set(event.venueId, existing);
    });

    // SVG icons per category (Lucide-style, monochrome)
    const categoryIcons: Record<string, string> = {
      "comedy": `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>`,
      "open-mic": `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`,
      "live-music": `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
      "quiz-night": `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
      "promo-date-night": `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="0"/><path d="m9 16 2 2 4-4"/></svg>`,
      "dj-music": `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4"/><path d="M12 18v4"/></svg>`,
      "language-exchange": `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>`,
      "social": `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/></svg>`,
      "singles": `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
      "pub-quiz": `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
      "screening": `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>`,
      "sport": `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 9 7 12 7s5-3 7.5-3a2.5 2.5 0 0 1 0 5H18"/><path d="M18 15h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M6 15H4.5a2.5 2.5 0 0 1 0-5H6"/><line x1="6" x2="18" y1="9" y2="9"/><line x1="6" x2="18" y1="15" y2="15"/><line x1="12" x2="12" y1="9" y2="15"/></svg>`,
    };
    const defaultIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

    // Add individual event markers with category icons
    events.forEach((event) => {
      const venue = venues.find((v) => v.id === event.venueId);
      if (!venue) return;

      const catInfo = categoryInfos.find((c) => c.label === event.category || c.id === event.categoryId);
      const svgIcon = (catInfo?.id && categoryIcons[catInfo.id]) || defaultIcon;

      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          width: 36px; height: 36px;
          background: hsl(0, 0%, 10%);
          border: 2px solid hsl(40, 20%, 93%);
          border-radius: 0;
          display: flex; align-items: center; justify-content: center;
          color: hsl(40, 20%, 93%);
          box-shadow: 2px 2px 0 rgba(0,0,0,0.4);
          transform: rotate(-2deg);
          cursor: pointer;
          transition: transform 0.15s, background 0.15s, color 0.15s;
        " onmouseenter="this.style.background='hsl(18,85%,52%)';this.style.color='white';this.style.transform='rotate(0deg) scale(1.15)'"
           onmouseleave="this.style.background='hsl(0,0%,10%)';this.style.color='hsl(40,20%,93%)';this.style.transform='rotate(-2deg) scale(1)'"
        >${svgIcon}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([venue.lat, venue.lng], { icon }).addTo(map);

      marker.bindPopup(
        `<div style="min-width:180px;">
          <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">${event.title}</div>
          <div style="font-family:'Space Mono',monospace;font-size:10px;color:#999;margin-bottom:6px;">${venue.name} · ${event.startTime}</div>
          <div style="cursor:pointer;font-family:'Space Mono',monospace;font-size:10px;color:hsl(18,85%,52%);text-transform:uppercase;letter-spacing:0.5px;" data-event-id="${event.id}">→ View details</div>
        </div>`,
        { className: "barlin-popup" }
      );

      marker.on("popupopen", () => {
        const popup = marker.getPopup();
        if (!popup) return;
        const el = popup.getElement();
        if (!el) return;
        el.querySelectorAll("[data-event-id]").forEach((node) => {
          (node as HTMLElement).addEventListener("click", () => {
            const id = node.getAttribute("data-event-id");
            if (id && onEventClick) {
              marker.closePopup();
              onEventClick(id);
            }
          });
        });
      });
    });
  }, [events, onEventClick]);

  return (
    <>
      <style>{`
        .barlin-popup .leaflet-popup-content-wrapper {
          background: hsl(0, 0%, 6%);
          color: hsl(40, 20%, 93%);
          border-radius: 0;
          border: 2px solid hsl(40, 20%, 93%);
          box-shadow: 4px 4px 0 rgba(0,0,0,0.3);
        }
        .barlin-popup .leaflet-popup-tip {
          background: hsl(0, 0%, 6%);
          border: 1px solid hsl(40, 20%, 93%);
        }
        .leaflet-container {
          font-family: 'DM Sans', sans-serif;
        }
      `}</style>
      <div ref={mapRef} className="w-full h-full min-h-[500px] border-2 border-foreground" />
    </>
  );
}
