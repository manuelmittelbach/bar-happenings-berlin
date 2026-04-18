import { useEffect, useRef, useMemo, useState } from "react";
import L from "leaflet";
import { getCategoryInfoByLabel } from "@/data/mockData";
import type { BarlinEvent, Venue } from "@/data/mockData";
import { cleanEventTitle } from "@/lib/cleanTitle";

interface EventMapProps {
  events: BarlinEvent[];
  venueMap: Record<string, Venue>;
  userLocation: { lat: number; lng: number } | null;
  onEventClick: (id: string) => void;
}

const BERLIN_CENTER: [number, number] = [52.52, 13.405];

const categoryIconPaths: Record<string, string> = {
  "comedy":           `<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>`,
  "pub-quiz":         `<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>`,
  "quiz-night":       `<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>`,
  "language-exchange":`<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>`,
  "social":           `<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11-8-1"/><path d="M4.73 18a2 2 0 1 1 3.46 2"/><path d="M11 17H4a2 2 0 0 1 0-4h.5"/>`,
  "singles":          `<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 1.5C10.5 3.5 9.26 3 7.5 3a5.5 5.5 0 0 0-5.5 5.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>`,
  "dj-music":         `<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>`,
  "live-music":       `<path d="m11.9 12.1 4.514-4.514"/><path d="M20.1 2.3a1 1 0 0 0-1.4 0l-1.114 1.114A2 2 0 0 0 17 4.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 17.828 7h1.344a2 2 0 0 0 1.414-.586L21.7 5.3a1 1 0 0 0 0-1.4z"/><path d="m6 16 2 2"/><path d="M8.2 9.9C8.7 8.8 9.8 8 11 8c2.8 0 5 2.2 5 5 0 1.2-.8 2.3-1.9 2.8l-.9.4A2 2 0 0 0 12 18a4 4 0 0 1-4 4c-3.3 0-6-2.7-6-6a4 4 0 0 1 4-4 2 2 0 0 0 1.8-1.2z"/><circle cx="11.5" cy="12.5" r=".5" fill="white"/>`,
  "open-mic":         `<path d="m11 7.601-5.994 8.19a1 1 0 0 0 .1 1.298l.817.818a1 1 0 0 0 1.314.087L15.09 12"/><path d="M16.5 21.174C15.5 20.5 14.372 20 13 20c-2.058 0-3.928 2.356-6 2-2.072-.356-2.775-3.369-1.5-4.5"/><circle cx="16" cy="7" r="5"/>`,
  "promo-date-night": `<path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H7c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/>`,
  "screening":        `<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 12h18"/><path d="M17 3v18"/>`,
  "sport":            `<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>`,
  "other":            `<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>`,
};

const MARKER_DEFAULT = "#6b7280";
const MARKER_ACTIVE  = "#f97316";

function markerHtml(categoryId: string, color: string) {
  const paths = categoryIconPaths[categoryId] ?? categoryIconPaths["other"];
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  return `<div class="event-marker" style="width:40px;height:40px;background:${MARKER_DEFAULT};border-radius:50%;display:flex;align-items:center;justify-content:center;border:2.5px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.35);transition:background 0.15s;">${icon}</div>`;
}

function badgeHtml(count: number) {
  return `<span style="display:flex;align-items:center;justify-content:center;width:16px;height:16px;background:white;color:#6b7280;font-size:9px;font-weight:700;border-radius:50%;font-family:monospace;border:1.5px solid #e5e7eb;line-height:1;">${count}</span>`;
}

export default function EventMap({ events, venueMap, userLocation, onEventClick }: EventMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const badgeMarkersRef = useRef<L.Marker[]>([]);
  const onEventClickRef = useRef(onEventClick);
  const [locating, setLocating] = useState(false);

  useEffect(() => { onEventClickRef.current = onEventClick; });

  const venueEvents = useMemo(() => {
    const map = new Map<string, BarlinEvent[]>();
    events.forEach((e) => {
      if (!e.venueId) return;
      const venue = venueMap[e.venueId];
      if (!venue?.lat || !venue?.lng) return;
      if (!map.has(e.venueId)) map.set(e.venueId, []);
      map.get(e.venueId)!.push(e);
    });
    return map;
  }, [events, venueMap]);

  // Effect 1: Initialize map once on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, { zoomControl: true }).setView(BERLIN_CENTER, 13);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    // Badge pane sits above the marker pane (600) so badges are never covered
    const badgePane = map.createPane("badge-pane");
    badgePane.style.zIndex = "610";
    badgePane.style.pointerEvents = "none";

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Effect 2: Update markers whenever data or location changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear all markers and overlays (keep tile layer)
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
    });
    // Wipe badge pane DOM directly — most reliable for custom panes
    const badgePane = map.getPane("badge-pane");
    if (badgePane) badgePane.innerHTML = "";
    badgeMarkersRef.current = [];

    // User location dot
    if (userLocation) {
      L.marker([userLocation.lat, userLocation.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:16px;height:16px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 0 0 3px rgba(59,130,246,0.3);"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
      }).addTo(map);
    }

    // Event markers
    venueEvents.forEach((venueEvts, venueId) => {
      const venue = venueMap[venueId];
      if (!venue?.lat || !venue?.lng) return;

      const info = getCategoryInfoByLabel(venueEvts[0].category);
      const categoryId = info?.id ?? "other";
      const color = info?.color ?? "#14b8a6";

      const marker = L.marker([venue.lat, venue.lng], {
        icon: L.divIcon({
          className: "",
          html: markerHtml(categoryId, color),
          iconSize: [40, 40],
          iconAnchor: [20, 20],
          popupAnchor: [0, -24],
        }),
      });

      const popupEl = document.createElement("div");
      popupEl.style.cssText = "min-width:190px;max-width:250px;font-family:sans-serif;";

      const scrollEl = document.createElement("div");
      scrollEl.className = "map-popup-scroll";
      scrollEl.style.cssText = "max-height:175px;overflow-y:auto;";

      const titleEl = document.createElement("p");
      titleEl.style.cssText =
        "font-weight:700;font-size:13px;margin:0 0 8px;border-bottom:1px solid #eee;padding-bottom:6px;";
      titleEl.textContent = `${venue.name} · ${venue.neighborhood}`;
      popupEl.appendChild(titleEl);

      venueEvts.forEach((evt) => {
        const btn = document.createElement("button");
        btn.className = "map-popup-btn";
        btn.style.cssText =
          "display:block;width:100%;text-align:left;padding:5px 0;border:none;border-bottom:1px solid #f0f0f0;background:none;cursor:pointer;";
        const dateStr = new Date(evt.date + "T00:00:00").toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
        });
        btn.innerHTML = `
          <p style="font-size:12px;font-weight:600;margin:0;color:#111;">${cleanEventTitle(evt.title, evt.venue)}</p>
          <p style="font-size:11px;color:#888;margin:2px 0 0;">${dateStr}${evt.startTime ? ` · ${evt.startTime}` : ""}</p>
        `;
        btn.addEventListener("click", () => {
          btn.style.background = "#f97316";
          btn.querySelector<HTMLElement>("p:first-child")!.style.color = "white";
          btn.querySelector<HTMLElement>("p:last-child")!.style.color = "rgba(255,255,255,0.75)";
          setTimeout(() => onEventClickRef.current(evt.id), 80);
        });
        scrollEl.appendChild(btn);
      });
      popupEl.appendChild(scrollEl);

      marker.bindPopup(popupEl).addTo(map);

      // Badge rendered in a separate pane above all markers — never covered
      if (venueEvts.length > 1) {
        const bm = L.marker([venue.lat, venue.lng], {
          icon: L.divIcon({
            className: "",
            html: badgeHtml(venueEvts.length),
            iconSize: [16, 16],
            // badge center at +17px right, -17px up from circle center → matches top:-5px;right:-5px
            iconAnchor: [-9, 25],
          }),
          pane: "badge-pane",
          interactive: false,
        } as L.MarkerOptions).addTo(map);
        badgeMarkersRef.current.push(bm);
      }

      const isMouseDevice = window.matchMedia("(pointer: fine)").matches;
      if (isMouseDevice) {
        marker.on("add", () => {
          const d = marker.getElement()?.querySelector<HTMLElement>(".event-marker");
          if (!d) return;
          d.addEventListener("pointerenter", () => { d.style.background = MARKER_ACTIVE; });
          d.addEventListener("pointerleave", () => { if (!marker.isPopupOpen()) d.style.background = MARKER_DEFAULT; });
        });
        marker.on("popupopen",  () => { const d = marker.getElement()?.querySelector<HTMLElement>(".event-marker"); if (d) d.style.background = MARKER_ACTIVE; });
        marker.on("popupclose", () => { const d = marker.getElement()?.querySelector<HTMLElement>(".event-marker"); if (d) d.style.background = MARKER_DEFAULT; });
      }
    });
  }, [venueEvents, venueMap, userLocation]);

  function flyToUser() {
    const map = mapRef.current;
    if (!map) return;
    if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 15, { duration: 1.2 });
      return;
    }
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        map.flyTo([pos.coords.latitude, pos.coords.longitude], 15, { duration: 1.2 });
      },
      () => {
        setLocating(false);
        alert("Bitte erlaube den Standortzugriff in deinen Browser-Einstellungen.");
      },
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
    );
  }

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
      <button
        onClick={flyToUser}
        title="Zu meinem Standort"
        style={{
          position: "absolute",
          bottom: 16,
          left: 16,
          zIndex: 1000,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "white",
          border: "1.5px solid #d1d5db",
          boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          opacity: 1,
        }}
      >
        <svg
          width="20" height="20" viewBox="0 0 24 24"
          fill={locating ? "none" : "#2563eb"}
          stroke={locating ? "#2563eb" : "none"}
          strokeWidth="2.5"
          strokeLinecap="round"
          className={locating ? "animate-spin" : ""}
        >
          {locating
            ? <path d="M12 2a10 10 0 0 1 10 10" />
            : <path d="M12 2L4 20l8-4 8 4L12 2z" transform="rotate(40 12 12)" />
          }
        </svg>
      </button>
    </div>
  );
}
