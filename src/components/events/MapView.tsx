import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { BarlinEvent } from "@/data/mockData";
import { venues, categoryInfos } from "@/data/mockData";

interface MapViewProps {
  events: BarlinEvent[];
  onEventClick?: (eventId: string) => void;
}

export default function MapView({ events, onEventClick }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const gpsMarkerRef = useRef<L.Marker | null>(null);
  const gpsCircleRef = useRef<L.Circle | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [52.52, 13.405],
      zoom: 12,
      zoomControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    mapInstance.current = map;

    // GPS blue dot
    let watchId: number | null = null;

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          const latlng: L.LatLngExpression = [latitude, longitude];

          if (!gpsMarkerRef.current) {
            const blueDotIcon = L.divIcon({
              className: "gps-blue-dot",
              html: `<div class="gps-dot"><div class="gps-dot-pulse"></div></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            });
            gpsMarkerRef.current = L.marker(latlng, { icon: blueDotIcon, zIndexOffset: 1000 }).addTo(map);
            gpsCircleRef.current = L.circle(latlng, {
              radius: accuracy,
              color: "rgba(66,133,244,0.3)",
              fillColor: "rgba(66,133,244,0.1)",
              fillOpacity: 0.3,
              weight: 1,
            }).addTo(map);
          } else {
            gpsMarkerRef.current.setLatLng(latlng);
            gpsCircleRef.current?.setLatLng(latlng);
            gpsCircleRef.current?.setRadius(accuracy);
          }
        },
        () => { /* permission denied or error — do nothing */ },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
      );
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
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
      "social": `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
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
        .gps-blue-dot { background: none !important; border: none !important; }
        .gps-dot {
          width: 16px; height: 16px;
          background: #4285F4;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 0 8px rgba(66,133,244,0.6);
          position: relative;
        }
        .gps-dot-pulse {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 16px; height: 16px;
          border-radius: 50%;
          border: 2px solid rgba(66,133,244,0.5);
          animation: gps-pulse 2s ease-out infinite;
        }
        @keyframes gps-pulse {
          0% { width: 16px; height: 16px; opacity: 1; }
          100% { width: 40px; height: 40px; opacity: 0; }
        }
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
      <div ref={mapRef} className="w-full h-full min-h-[500px] border-2 border-border" />
    </>
  );
}
