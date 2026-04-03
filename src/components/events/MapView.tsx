import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { BarlinEvent } from "@/data/mockData";
import { venues } from "@/data/mockData";

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

    venueEvents.forEach((evts, venueId) => {
      const venue = venues.find((v) => v.id === venueId);
      if (!venue) return;

      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          width: 32px; height: 32px;
          background: hsl(18, 85%, 52%);
          border: 2px solid hsl(40, 20%, 97%);
          border-radius: 0;
          display: flex; align-items: center; justify-content: center;
          color: white; font-family: 'Space Mono', monospace;
          font-size: 11px; font-weight: bold;
          box-shadow: 2px 2px 0 rgba(0,0,0,0.3);
          transform: rotate(-3deg);
          cursor: pointer;
        ">${evts.length}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const popupContent = evts
        .map(
          (e) =>
            `<div style="margin-bottom:8px;cursor:pointer;" data-event-id="${e.id}">
              <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">${e.title}</div>
              <div style="font-family:'Space Mono',monospace;font-size:10px;color:#999;margin-top:2px;">${e.startTime} · ${e.category}</div>
            </div>`
        )
        .join("");

      const marker = L.marker([venue.lat, venue.lng], { icon }).addTo(map);

      marker.bindPopup(
        `<div style="min-width:180px;">
          <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #333;">${venue.name}</div>
          <div style="font-family:'Space Mono',monospace;font-size:10px;color:#666;margin-bottom:8px;">${venue.neighborhood}</div>
          ${popupContent}
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
