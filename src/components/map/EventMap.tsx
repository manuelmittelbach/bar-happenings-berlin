import { useEffect, useRef, useMemo, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCategories } from "@/hooks/useEvents";
import type { BarlinEvent, Venue } from "@/types/event";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { requestLocationOnce } from "@/hooks/useUserLocation";
import { haversineMeters, walkingMinutes } from "@/lib/distance";
import { isLiveNow } from "@/lib/eventStatus";

interface EventMapProps {
	events: BarlinEvent[];
	venueMap: Record<string, Venue>;
	userLocation: { lat: number; lng: number } | null;
	onEventClick: (id: string) => void;
}

const BERLIN_CENTER: [number, number] = [13.405, 52.52];
const SOURCE_ID = "venues";
const LAYER_ICONS = "venue-icons";
const LAYER_PULSE = "venue-live-pulse";

// Walking-person SVG — Tabler "walk" icon: stick figure mid-stride
// (legs apart, arm forward). Used to live on event cards before the
// design refactor; reusing the same glyph keeps the language consistent
// if the chip ever returns to cards. Defined as a string because the
// MapLibre popup is built with vanilla DOM, not React.
const PERSON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 4a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M7 21l3 -4"/><path d="M16 21l-2 -4l-3 -3l1 -6"/><path d="M6 12l2 -3l4 -1l3 3l3 1"/></svg>`;

// Module-level cache: survives in-tab navigation (Liste↔Map) but dies on
// refresh, so a hard reload returns to Berlin-Default. Intentionally not
// sessionStorage — that would persist across refresh too.
let storedView: { center: [number, number]; zoom: number } | null = null;

const imageKey = (categoryId: string, count: number) =>
	count > 1 ? `cat-${categoryId}-${count}` : `cat-${categoryId}`;

const categoryIconPaths: Record<string, string> = {
	"comedy": `<circle cx="12" cy="12" r="10"/><path d="M18 13a6 6 0 0 1-6 5 6 6 0 0 1-6-5h12Z"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>`,
	"pub-quiz": `<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>`,
	"language-exchange": `<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>`,
	"social": `<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>`,
	"singles": `<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 1.5C10.5 3.5 9.26 3 7.5 3a5.5 5.5 0 0 0-5.5 5.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>`,
	"dj-music": `<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>`,
	"live-music": `<path d="m11.9 12.1 4.514-4.514"/><path d="M20.1 2.3a1 1 0 0 0-1.4 0l-1.114 1.114A2 2 0 0 0 17 4.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 17.828 7h1.344a2 2 0 0 0 1.414-.586L21.7 5.3a1 1 0 0 0 0-1.4z"/><path d="m6 16 2 2"/><path d="M8.2 9.9C8.7 8.8 9.8 8 11 8c2.8 0 5 2.2 5 5 0 1.2-.8 2.3-1.9 2.8l-.9.4A2 2 0 0 0 12 18a4 4 0 0 1-4 4c-3.3 0-6-2.7-6-6a4 4 0 0 1 4-4 2 2 0 0 0 1.8-1.2z"/><circle cx="11.5" cy="12.5" r=".5" fill="white"/>`,
	"open-mic": `<path d="m11 7.601-5.994 8.19a1 1 0 0 0 .1 1.298l.817.818a1 1 0 0 0 1.314.087L15.09 12"/><path d="M16.5 21.174C15.5 20.5 14.372 20 13 20c-2.058 0-3.928 2.356-6 2-2.072-.356-2.775-3.369-1.5-4.5"/><circle cx="16" cy="7" r="5"/>`,
	"karaoke": `<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/>`,
	"drag-cabaret": `<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.6a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.119a.5.5 0 0 1 .798-.52l4.276 3.563a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>`,
	"games": `<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M16 8h.01"/><path d="M8 8h.01"/><path d="M8 16h.01"/><path d="M16 16h.01"/><path d="M12 12h.01"/>`,
	"sports": `<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>`,
	"screening": `<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 12h18"/><path d="M17 3v18"/>`,
	"other": `<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>`,
};

async function buildCategoryImage(categoryId: string, color: string, count = 1): Promise<ImageData> {
	const SIZE = 80;
	const canvas = document.createElement("canvas");
	canvas.width = SIZE;
	canvas.height = SIZE;
	const ctx = canvas.getContext("2d")!;

	// Main circle — no white stroke, so the pulse halo behind a live
	// marker blends seamlessly into the disk's edge instead of being
	// interrupted by a hard white ring.
	ctx.beginPath();
	ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 4, 0, Math.PI * 2);
	ctx.fillStyle = color;
	ctx.fill();

	// SVG icon — wait for onload before drawing
	const paths = categoryIconPaths[categoryId] ?? categoryIconPaths["other"];
	const iconSvg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
	)}`;
	await new Promise<void>((resolve) => {
		const iconImg = new Image();
		iconImg.onload = () => { ctx.drawImage(iconImg, 24, 24, 32, 32); resolve(); };
		iconImg.onerror = () => resolve();
		iconImg.src = iconSvg;
	});

	// Count badge
	if (count > 1) {
		ctx.beginPath();
		ctx.arc(62, 20, 15, 0, Math.PI * 2);
		ctx.fillStyle = "white";
		ctx.fill();
		ctx.beginPath();
		ctx.arc(62, 20, 12, 0, Math.PI * 2);
		ctx.fillStyle = "#1f2937";
		ctx.fill();
		ctx.fillStyle = "white";
		ctx.font = `bold ${count > 9 ? 11 : 14}px Arial, sans-serif`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(String(count), 62, 20);
	}

	return ctx.getImageData(0, 0, SIZE, SIZE);
}

export default function EventMap({ events, venueMap, userLocation, onEventClick }: EventMapProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<maplibregl.Map | null>(null);
	const userMarkerRef = useRef<maplibregl.Marker | null>(null);
	const popupRef = useRef<maplibregl.Popup | null>(null);
	const onEventClickRef = useRef(onEventClick);
	const geojsonRef = useRef<GeoJSON.FeatureCollection>({ type: "FeatureCollection", features: [] });
	const sourceReadyRef = useRef(false);
	const [locating, setLocating] = useState(false);

	const [loadFailed, setLoadFailed] = useState(false);
	const [retryNonce, setRetryNonce] = useState(0);
	// Tick every 60s so the geojson useMemo re-evaluates `isLive` per
	// venue — an event that just started should begin pulsing without
	// requiring the user to refresh. 60s granularity is enough since
	// `isLiveNow` only changes state at minute boundaries.
	const [nowTick, setNowTick] = useState(0);
	useEffect(() => {
		const id = window.setInterval(() => setNowTick((n) => n + 1), 60_000);
		return () => window.clearInterval(id);
	}, []);

	const { data: categoryInfos = [] } = useCategories();
	const categoryById = useMemo(
		() => Object.fromEntries(categoryInfos.map((c) => [c.id, c])),
		[categoryInfos],
	);

	// Refs mirror the latest category data so the map "load" callback (whose
	// closure is captured at mount time with empty arrays) sees current values
	// when it fires after data has arrived. Without this, base/badge icons get
	// registered with the gray fallback and stay gray forever (since hasImage
	// returns true and re-registration is skipped).
	const categoryInfosRef = useRef(categoryInfos);
	const categoryByIdRef = useRef(categoryById);
	useEffect(() => {
		categoryInfosRef.current = categoryInfos;
		categoryByIdRef.current = categoryById;
	}, [categoryInfos, categoryById]);

	useEffect(() => { onEventClickRef.current = onEventClick; }, [onEventClick]);

	// Same pattern as onEventClick: the click handler on LAYER_ICONS is
	// registered once inside the "load" callback, so without a ref it
	// would forever see the userLocation that existed at mount time.
	const userLocationRef = useRef(userLocation);
	useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);

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

	const geojson = useMemo((): GeoJSON.FeatureCollection => ({
		type: "FeatureCollection",
		features: Array.from(venueEvents.entries()).map(([venueId, evts]) => {
			const venue = venueMap[venueId];
			const info = categoryById[evts[0].category];
			const categoryId = info?.id ?? "other";
			const allCanceled = evts.every((e) => e.status === "canceled");
			// Live = at least one non-canceled event at this venue is currently
			// between its startTime and endTime. Drives the pulse layer
			// underneath the marker so live venues read at a glance.
			const isLive = evts.some((e) => e.status !== "canceled" && isLiveNow(e));
			// Pulse uses the category color so the halo behind each live
			// marker reads as the same "family" as its disk (DJ marker → DJ
			// pulse, comedy → comedy, etc.) instead of one unified orange.
			const pulseColor = info?.color ?? "#ED5B1C";
			return {
				type: "Feature",
				geometry: { type: "Point", coordinates: [venue.lng, venue.lat] },
				properties: {
					venueId,
					venueName: venue.name,
					neighborhood: venue.neighborhood,
					categoryId,
					count: evts.length,
					allCanceled,
					isLive,
					pulseColor,
					eventsJson: JSON.stringify(
						evts.map((e) => ({
							id: e.id,
							title: cleanEventTitle(e.title, e.venue),
							date: e.date,
							startTime: e.startTime ?? "",
							// endTime carried into the popup so isLiveNow() can run
							// at click time and swap the time string for a pulsing
							// "Now" indicator on currently-live events.
							endTime: e.endTime ?? "",
							status: e.status,
							canceledBy: e.canceledBy ?? null,
							// Per-event category color so the popup button can hover/
							// click in the category hue (Live Music → green, DJ → purple,
							// etc.) instead of a unified orange.
							categoryColor: categoryById[e.category]?.color ?? "#ED5B1C",
						}))
					),
				},
			};
		}),
		// nowTick included so live-state refreshes every minute without needing
		// a full data refetch or user-triggered re-render.
	}), [venueEvents, venueMap, categoryById, nowTick]);

	// Initialize map, load icons, add layers
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		setLoadFailed(false);

		const map = new maplibregl.Map({
			container,
			style: "https://tiles.openfreemap.org/styles/positron",
			center: storedView?.center ?? BERLIN_CENTER,
			zoom: storedView?.zoom ?? 11,
			minZoom: 10,
			maxBounds: [[13.0, 52.3], [13.8, 52.75]],
			attributionControl: false,
		});

		// Watchdog: if MapLibre never fires "load" within 8s, the style or tiles
		// likely failed (carrier blocking openfreemap, dropped CDN, etc.).
		// Tear the silent half-rendered map down and surface a retry UI.
		const watchdogId = window.setTimeout(() => {
			if (mapRef.current === map) {
				map.remove();
				mapRef.current = null;
				sourceReadyRef.current = false;
			}
			setLoadFailed(true);
		}, 8000);

		// requestAnimationFrame id for the pulse animation — closed over the
		// useEffect cleanup so it gets cancelled on unmount / retry.
		let pulseRafId: number | null = null;

		// Cache the view in module state on every settled pan/zoom so navigating
		// away (e.g. to an event detail) and back restores the user's exact
		// position. Module state dies on refresh — that's intentional.
		map.on("moveend", () => {
			const c = map.getCenter();
			storedView = { center: [c.lng, c.lat], zoom: map.getZoom() };
		});

		map.on("load", () => {
			window.clearTimeout(watchdogId);
			(async () => {
				// Register base category images (uses refs so we see latest data
				// even though this callback was captured at mount time)
				await Promise.all(
					categoryInfosRef.current.map(async (cat) => {
						if (!map.hasImage(`cat-${cat.id}`))
							map.addImage(`cat-${cat.id}`, await buildCategoryImage(cat.id, cat.color), { pixelRatio: 2 });
					})
				);
				// Gray fallback only if the DB doesn't define an "other" category
				// — otherwise the iteration above already registered cat-other with
				// the real DB color and a hardcoded gray here would shadow it.
				const hasOther = categoryInfosRef.current.some((c) => c.id === "other");
				if (!hasOther && !map.hasImage("cat-other")) {
					map.addImage("cat-other", await buildCategoryImage("other", "#6b7280"), { pixelRatio: 2 });
				}

				// Pre-register badge images for data already in ref
				const seen = new Set<string>();
				await Promise.all(
					geojsonRef.current.features.map(async (f) => {
						const { categoryId, count } = f.properties as { categoryId: string; count: number };
						if (count <= 1) return;
						const key = imageKey(categoryId, count);
						if (!seen.has(key) && !map.hasImage(key)) {
							seen.add(key);
							const color = categoryByIdRef.current[categoryId]?.color ?? "#6b7280";
							map.addImage(key, await buildCategoryImage(categoryId, color, count), { pixelRatio: 2 });
						}
					})
				);

				map.addSource(SOURCE_ID, {
					type: "geojson",
					data: geojsonRef.current,
				});
				sourceReadyRef.current = true;

				// Pulse layer — sits BELOW the icons so it renders behind each
				// live venue's disk. Filtered to features with isLive === true so
				// non-live markers don't draw the circle. circle-radius and
				// circle-opacity are mutated every animation frame to create the
				// outward ripple.
				map.addLayer({
					id: LAYER_PULSE,
					type: "circle",
					source: SOURCE_ID,
					filter: ["==", ["get", "isLive"], true],
					paint: {
						"circle-radius": 22,
						"circle-color": ["get", "pulseColor"],
						"circle-opacity": 0.55,
						"circle-blur": 0.4,
					},
				});

				// Symbol layer — icons with badge baked in, rendered in WebGL
				map.addLayer({
					id: LAYER_ICONS,
					type: "symbol",
					source: SOURCE_ID,
					layout: {
						"icon-image": [
							"case",
							[">", ["get", "count"], 1],
							["concat", "cat-", ["get", "categoryId"], "-", ["to-string", ["get", "count"]]],
							["concat", "cat-", ["get", "categoryId"]],
						],
						"icon-size": 1,
						"icon-allow-overlap": true,
					},
					paint: {
						// Dim venues whose events are all canceled — at-a-glance signal
						// that the marker still exists but nothing is happening there.
						"icon-opacity": ["case", ["get", "allCanceled"], 0.45, 1.0],
					},
				});

				// Pulse animation — outward ripple: radius grows linearly from
				// 18→33px over each 2200ms cycle, while opacity follows a sine
				// curve (0 → 0.32 → 0). The sin opacity hides the radius reset
				// at the cycle boundary so there's no jerky stop — the pulse
				// fades in at the start, peaks mid-cycle, fades out at the end,
				// and the next cycle starts fresh from radius 18.
				const pulseStart = performance.now();
				const animatePulse = (now: number) => {
					const t = ((now - pulseStart) / 2200) % 1;
					if (map.getLayer(LAYER_PULSE)) {
						map.setPaintProperty(LAYER_PULSE, "circle-radius", 18 + t * 28);
						map.setPaintProperty(
							LAYER_PULSE,
							"circle-opacity",
							0.32 * Math.sin(t * Math.PI),
						);
					}
					pulseRafId = requestAnimationFrame(animatePulse);
				};
				pulseRafId = requestAnimationFrame(animatePulse);

				map.on("mouseenter", LAYER_ICONS, () => { map.getCanvas().style.cursor = "pointer"; });
				map.on("mouseleave", LAYER_ICONS, () => { map.getCanvas().style.cursor = ""; });

				map.on("click", LAYER_ICONS, (e) => {
					if (!e.features?.length) return;
					const props = e.features[0].properties as {
						venueName: string;
						neighborhood: string;
						eventsJson: string;
					};
					const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
					const evts: {
						id: string;
						title: string;
						date: string;
						startTime: string;
						endTime: string;
						status?: string;
						canceledBy?: "organizer" | "admin" | null;
						categoryColor: string;
					}[] = JSON.parse(props.eventsJson);

					const popupEl = document.createElement("div");
					popupEl.style.cssText = "min-width:260px;max-width:340px;font-family:sans-serif;border:1px solid #d1d5db;border-radius:3px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.12);";

					// Header strip — venue name on the left, walking-time chip
					// on the right when the user's location is known. Right
					// padding stays at 40px so MapLibre's close button (also
					// absolutely positioned in the top-right) has room.
					const headerEl = document.createElement("div");
					headerEl.style.cssText =
						"display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid #d1d5db;padding:11px 40px 11px 12px;background:#f5f5f5;";

					const nameEl = document.createElement("p");
					nameEl.style.cssText = "font-weight:700;font-size:15px;margin:0;flex:1 1 auto;min-width:0;";
					nameEl.textContent = props.venueName;
					headerEl.appendChild(nameEl);

					const ul = userLocationRef.current;
					if (ul) {
						const meters = haversineMeters(ul.lat, ul.lng, coords[1], coords[0]);
						const min = walkingMinutes(meters);
						// Only surface the chip when the venue is genuinely within
						// walking range. Past ~20 min users would U-Bahn/bike, so
						// the indicator stops being useful and just clutters the
						// header.
						if (min <= 20) {
						const walkEl = document.createElement("span");
						walkEl.style.cssText =
							"display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;color:#ED5B1C;white-space:nowrap;flex-shrink:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;";
						walkEl.setAttribute("title", `~${min} min walking from your location`);
						walkEl.innerHTML = `${PERSON_SVG}<span>${min} min</span>`;
						headerEl.appendChild(walkEl);
						}
					}

					popupEl.appendChild(headerEl);

					const scrollEl = document.createElement("div");
					scrollEl.className = "map-popup-scroll";
					scrollEl.style.cssText = "max-height:220px;overflow-x:hidden;overflow-y:auto;padding:4px 12px;";
					evts.forEach((evt) => {
						const btn = document.createElement("button");
						const isLast = evts.indexOf(evt) === evts.length - 1;
						const isCanceled = evt.status === "canceled";
						btn.className = "map-popup-btn";
						btn.style.cssText = `display:block;width:100%;text-align:left;padding:5px 0;border:none;${isLast ? "" : "border-bottom:1px solid #f0f0f0;"}background:none;cursor:pointer;`;
						// `--hover-color` CSS custom property drives the `:hover`
						// background defined in index.css for `.map-popup-btn`.
						// Setting it per-button lets each event row hover in its
						// own category hue (Live Music → green, DJ → purple, etc.).
						btn.style.setProperty("--hover-color", evt.categoryColor);
						const dateStr = new Date(evt.date + "T00:00:00").toLocaleDateString("en-GB", {
							weekday: "short", day: "numeric", month: "short",
						});
						const titleP = document.createElement("p");
						titleP.style.cssText = `font-size:14px;font-weight:600;margin:0;color:${isCanceled ? "#888" : "#111"};${isCanceled ? "text-decoration:line-through;" : ""}`;
						titleP.textContent = evt.title;
						const metaP = document.createElement("p");
						metaP.style.cssText = "font-size:12px;color:#888;margin:3px 0 0;";
						if (isCanceled) {
							const badge = document.createElement("span");
							badge.textContent = evt.canceledBy === "admin" ? "CANCELED" : "CANCELED BY ORGANIZER";
							badge.style.cssText = "display:inline-block;font-size:10px;font-weight:700;letter-spacing:0.5px;color:#dc2626;background:#fee2e2;padding:1px 6px;margin-right:6px;border-radius:2px;";
							metaP.appendChild(badge);
						}
						metaP.appendChild(document.createTextNode(dateStr));
						if (evt.startTime) {
							const sep = document.createElement("span");
							sep.style.cssText = "opacity:0.5;margin:0 4px;";
							sep.textContent = "·";
							metaP.appendChild(sep);
							// Live = currently between startTime and endTime → swap the
							// time text for an "● Now" indicator with a pulsing orange
							// dot. Mirrors the EventMeta caps row on the home page so the
							// affordance language stays consistent across surfaces.
							const liveNow =
								!isCanceled &&
								isLiveNow({
									date: evt.date,
									startTime: evt.startTime,
									endTime: evt.endTime || undefined,
								});
							if (liveNow) {
								const nowEl = document.createElement("span");
								nowEl.style.cssText =
									"display:inline-flex;align-items:center;gap:5px;color:#ED5B1C;font-weight:700;";
								const dot = document.createElement("span");
								dot.style.cssText =
									"display:inline-block;width:7px;height:7px;border-radius:50%;background:#ED5B1C;animation:ib-pulse 1.6s ease-in-out infinite;";
								nowEl.appendChild(dot);
								nowEl.appendChild(document.createTextNode("Now"));
								metaP.appendChild(nowEl);
							} else {
								metaP.appendChild(document.createTextNode(evt.startTime));
							}
						}
						btn.appendChild(titleP);
						btn.appendChild(metaP);
						btn.addEventListener("click", () => {
							btn.style.background = evt.categoryColor;
							btn.querySelector<HTMLElement>("p:first-child")!.style.color = "white";
							btn.querySelector<HTMLElement>("p:last-child")!.style.color = "rgba(255,255,255,0.75)";
							setTimeout(() => onEventClickRef.current(evt.id), 80);
						});
						scrollEl.appendChild(btn);
					});
					popupEl.appendChild(scrollEl);

					popupRef.current?.remove();
					const popup = new maplibregl.Popup({ offset: 24, maxWidth: "260px" })
						.setLngLat(coords)
						.setDOMContent(popupEl)
						.addTo(map);
					popup.on("close", () => {
						if (popupRef.current === popup) popupRef.current = null;
					});
					popupRef.current = popup;
				});
			})();
		});

		mapRef.current = map;
		return () => {
			window.clearTimeout(watchdogId);
			if (pulseRafId !== null) cancelAnimationFrame(pulseRafId);
			if (mapRef.current === map) {
				map.remove();
				mapRef.current = null;
				sourceReadyRef.current = false;
			}
		};
	}, [retryNonce]);

	// Update data when events change — register any missing badge images first
	useEffect(() => {
		geojsonRef.current = geojson;
		// Filter changed → close any open popup, since its event list is now stale.
		popupRef.current?.remove();
		popupRef.current = null;
		if (!sourceReadyRef.current) return;
		const map = mapRef.current;
		if (!map) return;
		// Wait for category metadata before registering images: otherwise the first
		// pass caches every icon with the gray fallback color, and MapLibre's
		// hasImage() check stops us from ever re-registering with the real color.
		if (categoryInfos.length === 0) return;

		// Dedupe by image key — multiple clusters can share the same icon
		// (same category + count). Without this, parallel addImage calls race
		// past the hasImage() check and MapLibre throws "image already exists".
		const seen = new Set<string>();
		const needed: { categoryId: string; count: number }[] = [];
		for (const f of geojson.features) {
			const categoryId = f.properties!.categoryId as string;
			const count = f.properties!.count as number;
			const key = imageKey(categoryId, count);
			if (seen.has(key) || map.hasImage(key)) continue;
			seen.add(key);
			needed.push({ categoryId, count });
		}

		const apply = () => {
			(map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource)?.setData(geojson);
		};

		(async () => {
			await Promise.all(
				needed.map(async ({ categoryId, count }) => {
					const key = imageKey(categoryId, count);
					if (map.hasImage(key)) return;
					const color = categoryById[categoryId]?.color ?? "#6b7280";
					map.addImage(key, await buildCategoryImage(categoryId, color, count), { pixelRatio: 2 });
				})
			);
			apply();
		})();
	}, [geojson, categoryInfos, categoryById]);

	// User location dot
	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;
		userMarkerRef.current?.remove();
		userMarkerRef.current = null;
		if (!userLocation) return;
		const el = document.createElement("div");
		el.style.cssText =
			"width:16px;height:16px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 0 0 3px rgba(59,130,246,0.3);";
		userMarkerRef.current = new maplibregl.Marker({ element: el })
			.setLngLat([userLocation.lng, userLocation.lat])
			.addTo(map);
	}, [userLocation]);

	async function flyToUser() {
		const map = mapRef.current;
		if (!map) return;
		if (userLocation) {
			map.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 15, duration: 1200 });
			return;
		}
		if (!navigator.geolocation) return;
		setLocating(true);
		const loc = await requestLocationOnce();
		setLocating(false);
		if (!loc) {
			alert("Location access was denied.\n\niOS: Settings → Privacy & Security → Location Services → Safari → Allow While Using App\n\nAndroid/Desktop: allow location in your browser settings.");
			return;
		}
		map.flyTo({ center: [loc.lng, loc.lat], zoom: 15, duration: 1200 });
	}

	return (
		<div style={{ position: "absolute", inset: 0 }}>
			<div ref={containerRef} style={{ height: "100%", width: "100%" }} />
			{loadFailed && (
				<div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
					<p className="font-body font-bold text-base">Map konnte nicht geladen werden.</p>
					<p className="text-sm text-muted-foreground max-w-xs">
						Verbindung schwach oder Tile-Server nicht erreichbar.
					</p>
					<button
						onClick={() => setRetryNonce((n) => n + 1)}
						className="inline-flex h-11 px-6 items-center bg-foreground text-background font-heading font-bold uppercase tracking-widest text-xs hover:bg-foreground/90 transition-colors"
					>
						Erneut versuchen
					</button>
				</div>
			)}
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
