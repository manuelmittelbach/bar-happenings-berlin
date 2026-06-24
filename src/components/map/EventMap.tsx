import { useEffect, useRef, useMemo, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Capacitor } from "@capacitor/core";
import { useCategories } from "@/hooks/useEvents";
import type { BarlinEvent, Venue } from "@/types/event";
import { cleanEventTitle } from "@/lib/cleanTitle";
import { requestLocationFresh } from "@/hooks/useUserLocation";
import { haversineMeters, walkingMinutes } from "@/lib/distance";
import { isLiveNow } from "@/lib/eventStatus";
import { ErrorState } from "@/components/ui/error-state";

interface EventMapProps {
	events: BarlinEvent[];
	venueMap: Record<string, Venue>;
	userLocation: { lat: number; lng: number } | null;
	onEventClick: (id: string) => void;
	onVenueClick: (venueId: string) => void;
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

// Right-pointing chevron — the "this opens a page" affordance shared by
// the venue-name link and each event row, so both read as tappable. Drawn
// with currentColor so a parent style/hover rule can flip its hue.
const CHEVRON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`;

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
	"social": `<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>`,
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

export default function EventMap({ events, venueMap, userLocation, onEventClick, onVenueClick }: EventMapProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<maplibregl.Map | null>(null);
	const userMarkerRef = useRef<maplibregl.Marker | null>(null);
	const popupRef = useRef<maplibregl.Popup | null>(null);
	const onEventClickRef = useRef(onEventClick);
	const onVenueClickRef = useRef(onVenueClick);
	const geojsonRef = useRef<GeoJSON.FeatureCollection>({ type: "FeatureCollection", features: [] });
	const sourceReadyRef = useRef(false);
	// Counts watchdog-triggered auto re-inits. After returning from a
	// backgrounded tab (esp. mobile), the FIRST map build often stalls — the
	// page's GL/network layer isn't fully "awake" yet — but an immediate
	// rebuild loads instantly. So instead of dumping a manual retry on the
	// user, the watchdog silently rebuilds a couple of times first; the
	// manual ErrorState only surfaces if even those fail (a real outage).
	const autoRetryRef = useRef(0);
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
	useEffect(() => { onVenueClickRef.current = onVenueClick; }, [onVenueClick]);

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
							// Per-event category id + color so the popup row can
							// render the matching icon disc and hover/click in the
							// category hue (Live Music → green, DJ → purple, etc.).
							categoryId: e.category ?? "other",
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

		// Watchdog: if MapLibre never fires "load" in time, the style or tiles
		// likely failed (carrier blocking openfreemap, dropped CDN, etc.) —
		// OR the page just resumed from background and the first build stalled.
		// While auto-retries remain, use a SHORT timeout and rebuild silently
		// (the resume stall clears on the next attempt). Once they're spent,
		// fall back to the LONG timeout (a genuinely slow connection deserves
		// a fair shot) before surfacing the manual retry UI. Native (Capacitor)
		// gets a longer ceiling — mobile + cold WebView cache pushes first paint.
		const MAX_AUTO_RETRIES = 2;
		const hasAutoRetriesLeft = autoRetryRef.current < MAX_AUTO_RETRIES;
		// 3s for auto-retries: a hung resume never paints (so shorter heals
		// faster), but a healthy cold mobile load needs ~1–3s — going below 3s
		// risks aborting a load that was merely slow, causing a rebuild flicker.
		const watchdogMs = hasAutoRetriesLeft
			? 3000
			: Capacitor.isNativePlatform() ? 20000 : 10000;

		// Tear the map down and either silently rebuild (auto-retry budget
		// left) or surface the manual retry UI. Shared by every failure
		// detector below: the style/load watchdog, the tile watchdog, and the
		// idle-with-errors check.
		const recover = () => {
			if (mapRef.current === map) {
				map.remove();
				mapRef.current = null;
				sourceReadyRef.current = false;
			}
			if (autoRetryRef.current < MAX_AUTO_RETRIES) {
				// Self-heal: bump the counter and re-run this effect via
				// retryNonce. No error UI — the user just sees a brief blank.
				autoRetryRef.current += 1;
				setRetryNonce((n) => n + 1);
			} else {
				setLoadFailed(true);
			}
		};

		// Phase 1 — style/engine watchdog: fires if MapLibre never reaches the
		// "load" event (style JSON unreachable, GL context failed, or a
		// backgrounded tab that stalled on resume).
		const watchdogId = window.setTimeout(recover, watchdogMs);

		// Phase 2 — tile watchdog + error tally. `load` only means the style
		// JSON arrived; the actual map tiles paint afterwards over the network.
		// A blocked/slow tile CDN leaves the map blank with just our markers
		// floating on white — the exact "sometimes loads like this" bug. So we
		// DON'T treat `load` as success: we wait for the map to go `idle`
		// (initial tiles settled) and confirm no tile fetch errored along the
		// way. `idle` clears its pending set on BOTH success and failure, so
		// the error tally is what distinguishes a painted map from a blank one.
		let tilesWatchdogId: number | null = null;
		let tileErrors = 0;
		const onError = (e: { sourceId?: string }) => {
			// Our own GeoJSON markers load locally and never fetch, so any
			// errored source here is the background tiles/sprite/glyphs.
			if (e?.sourceId === SOURCE_ID) return;
			tileErrors += 1;
		};
		const settle = (ok: boolean) => {
			if (tilesWatchdogId !== null) window.clearTimeout(tilesWatchdogId);
			tilesWatchdogId = null;
			map.off("idle", onIdle);
			map.off("error", onError);
			// Only a fully-painted map refreshes the auto-retry budget for the
			// next resume; a blank/failed one leaves it spent.
			if (ok) autoRetryRef.current = 0;
		};
		const onIdle = () => {
			if (tileErrors > 0 && autoRetryRef.current < MAX_AUTO_RETRIES) {
				// Engine settled but tiles failed to fetch → blank map. Rebuild
				// silently while budget remains (a retry usually hits warm
				// tiles). Once budget's spent we accept whatever painted rather
				// than flashing an error over a map that may be partly there.
				settle(false);
				recover();
			} else {
				// Tiles painted (or budget spent on a partial map). Only NOW do we
				// start the pulse ripple — its per-frame setPaintProperty keeps the
				// map permanently rendering, so starting it before this point would
				// stop `idle` from ever firing and make the tile watchdog rebuild
				// on a loop.
				settle(true);
				startPulse();
			}
		};
		map.on("error", onError);

		// requestAnimationFrame id for the pulse animation — closed over the
		// useEffect cleanup so it gets cancelled on unmount / retry.
		let pulseRafId: number | null = null;

		// Pulse ripple for live venues — outward ripple: radius grows linearly
		// from 18→33px over each 2200ms cycle, while opacity follows a sine curve
		// (0 → 0.32 → 0). The sin opacity hides the radius reset at the cycle
		// boundary so there's no jerky stop. Started from onIdle (NOT here / not
		// in the layer setup): the per-frame setPaintProperty marks the map dirty
		// every tick, so if it ran before the first `idle` the map would never go
		// idle and the tile watchdog would tear down + rebuild on a loop. The
		// getLayer guard lets it spin harmlessly until the pulse layer is added.
		const startPulse = () => {
			const pulseStart = performance.now();
			const animatePulse = (now: number) => {
				const t = ((now - pulseStart) / 2200) % 1;
				if (map.getLayer(LAYER_PULSE)) {
					// Clamp opacity to [0, 1] — MapLibre's validator rejects
					// near-zero values produced by floating-point edges of
					// sin(t·π) at the cycle boundaries on Android WebView.
					const opacity = Math.max(0, Math.min(1, 0.32 * Math.sin(t * Math.PI)));
					map.setPaintProperty(LAYER_PULSE, "circle-radius", 18 + t * 28);
					map.setPaintProperty(LAYER_PULSE, "circle-opacity", opacity);
				}
				pulseRafId = requestAnimationFrame(animatePulse);
			};
			pulseRafId = requestAnimationFrame(animatePulse);
		};

		// Cache the view in module state on every settled pan/zoom so navigating
		// away (e.g. to an event detail) and back restores the user's exact
		// position. Module state dies on refresh — that's intentional.
		map.on("moveend", () => {
			const c = map.getCenter();
			storedView = { center: [c.lng, c.lat], zoom: map.getZoom() };
		});

		map.on("load", () => {
			window.clearTimeout(watchdogId);
			// Style JSON arrived, but the tiles paint over the network next.
			// Start the tile watchdog and wait for `idle` before declaring the
			// map loaded (see Phase 2 above). Tiles run a touch slower than the
			// style, so give the auto-retry pass 4s; full ceilings otherwise.
			const tilesWatchdogMs = hasAutoRetriesLeft
				? 4000
				: Capacitor.isNativePlatform() ? 20000 : 10000;
			tilesWatchdogId = window.setTimeout(() => {
				// Tiles never settled (hung CDN) → no `idle` ever fired. Recover.
				settle(false);
				recover();
			}, tilesWatchdogMs);
			map.on("idle", onIdle);
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

				// Pulse animation is started from onIdle once tiles confirm
				// painted (see startPulse above) — not here, or the per-frame
				// repaint would block the `idle` the tile watchdog waits on.

				map.on("mouseenter", LAYER_ICONS, () => { map.getCanvas().style.cursor = "pointer"; });
				map.on("mouseleave", LAYER_ICONS, () => { map.getCanvas().style.cursor = ""; });

				map.on("click", LAYER_ICONS, (e) => {
					if (!e.features?.length) return;
					const props = e.features[0].properties as {
						venueId: string;
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
						categoryId: string;
						categoryColor: string;
					}[] = JSON.parse(props.eventsJson);

					// Editorial popup — cream paper, soft 1px ink border + subtle
					// drop shadow for definition without the brutalist 2px rule.
					// Sharp corners stay (editorial signature). Width is content-
					// driven: shrinks around short venue names, expands up to
					// 320px for longer ones (titles wrap to a second line past
					// the cap rather than ellipsing).
					const popupEl = document.createElement("div");
					popupEl.style.cssText =
						// min-width bumped to 300px so popups stay close to the
						// 320px max even when content (short venue + short event
						// titles like "Pubquiz") wouldn't naturally drive the box
						// wider. The 80px band between min and max keeps the
						// box from looking pinched.
						"display:inline-block;min-width:300px;max-width:320px;font-family:'DM Sans',system-ui,sans-serif;background:#f8f5ef;border:1px solid #0f0f0f;border-radius:0;overflow:hidden;box-shadow:0 6px 20px rgba(15,15,15,0.1),0 1px 3px rgba(15,15,15,0.06);";

					// HEADER — Georgia serif venue name, walking chip right-
					// aligned. 40px right padding leaves room for the
					// absolutely-positioned close button.
					const headerEl = document.createElement("div");
					headerEl.className = "map-popup-header";
					// The whole header is the venue's tap target (not just the
					// name/chevron) — cursor:pointer when there's a bar to open.
					// The close button is a separate element painted on top, so
					// its own clicks never reach this header handler.
					headerEl.style.cssText =
						`padding:14px 44px 12px 14px;border-bottom:1px solid #d2cdc2;background:#f8f5ef;${props.venueId ? "cursor:pointer;" : ""}`;

					const nameRow = document.createElement("div");
					nameRow.style.cssText =
						"display:flex;align-items:flex-end;justify-content:space-between;gap:10px;";

					// Venue name is a tappable link to /bar/<id> — the popup is
					// venue-centric (the user just tapped a marker), so opening
					// the bar page from here matches expectation. Styled as a
					// button so it inherits accessibility semantics; cursor +
					// hover-accent telegraph affordance, mobile users get the
					// implicit "tap the bar name on a map pin opens the bar"
					// affordance.
					// Real anchor (href=/bar/<id>) so Cmd/Ctrl/middle-click opens
					// the bar in a new tab, matching the links on the event page.
					// leftCluster is a block (not flex) and flex:1 as a nameRow
					// child, so it fills the row, pushes the walk chip to the far
					// right, and gives the name a normal inline formatting context
					// to wrap inside.
					const leftCluster = document.createElement("div");
					leftCluster.style.cssText =
						"display:block;flex:1 1 auto;min-width:0;";

					const nameEl = document.createElement("a");
					nameEl.style.cssText =
						// overflow-wrap:break-word (not :anywhere) — only break
						// long unhyphenated venue names when truly necessary.
						// `:anywhere` was too aggressive and let the browser
						// collapse the popup to min-width 220 by breaking even
						// inside otherwise-fitting words, leaving lots of empty
						// horizontal space. `break-word` keeps words intact when
						// they can fit and only breaks them as a last resort.
						"font-family:Georgia,'Charter','Iowan Old Style',serif;font-weight:700;font-size:20px;line-height:1.15;margin:0;color:#0f0f0f;overflow-wrap:break-word;cursor:pointer;transition:color 0.12s ease;text-decoration:none;-webkit-touch-callout:default;-webkit-user-select:text;user-select:text;";
					nameEl.className = "map-popup-venue-link";
					// The chevron lives INSIDE this one anchor (a separate <a> can't
					// nest in an <a>) so it can be glued to the last word with a
					// nowrap wrapper — that's what guarantees it flows after the
					// LAST wrapped line and never orphans onto a line of its own.
					// The whole-header tap + this anchor's href already cover plain
					// click + Cmd/Ctrl-click, so a plain <span> cue is enough here.
					if (props.venueId) {
						const words = props.venueName.trim().split(/\s+/);
						const lastWord = words.pop() ?? props.venueName;
						const lead = words.join(" ");
						// Leading words wrap normally; the last word + chevron are one
						// nowrap unit, so a line break can land before the last word
						// but never between it and the chevron.
						if (lead) nameEl.appendChild(document.createTextNode(lead + " "));
						const tail = document.createElement("span");
						tail.style.cssText = "white-space:nowrap;";
						tail.appendChild(document.createTextNode(lastWord));
						const chevronIcon = document.createElement("span");
						chevronIcon.className = "map-popup-chevron";
						chevronIcon.style.cssText =
							// Inline cue glued to the last word. vertical-align:
							// text-bottom seats it on the text's bottom edge and
							// translateY(-2px) lifts it a tick from there.
							"display:inline-flex;align-items:center;color:#6b6b6b;transition:color 0.12s ease;margin-left:8px;vertical-align:text-bottom;transform:translateY(-2px);";
						chevronIcon.innerHTML = CHEVRON_SVG;
						tail.appendChild(chevronIcon);
						nameEl.appendChild(tail);
						// Real anchor (href=/bar/<id>) for Cmd/Ctrl/middle-click → new
						// tab + keyboard/screen-reader access. Plain clicks are handled
						// by the whole-header handler below.
						nameEl.setAttribute("href", `/bar/${props.venueId}`);
					} else {
						nameEl.textContent = props.venueName;
					}
					nameEl.setAttribute("aria-label", `Open ${props.venueName} page`);
					leftCluster.appendChild(nameEl);

					nameRow.appendChild(leftCluster);

					// Walk-distance chip — far-right element of the row, after the
					// name+chevron cluster. Bottom-aligned (nameRow is flex-end) so
					// it sits on the name's last line. Only surfaced when the venue
					// is within ~15 min walking; past that users U-Bahn/bike and the
					// cue just clutters. Same 15min threshold powers the index
					// page's "Nearby tonight" section, kept in sync deliberately.
					let walkEl: HTMLSpanElement | null = null;
					const ul = userLocationRef.current;
					if (ul) {
						const meters = haversineMeters(ul.lat, ul.lng, coords[1], coords[0]);
						const min = walkingMinutes(meters);
						if (min <= 15) {
							walkEl = document.createElement("span");
							walkEl.style.cssText =
								"display:inline-flex;align-items:center;gap:4px;font-family:'Space Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;font-weight:700;color:#ED5B1C;white-space:nowrap;flex-shrink:0;line-height:1;text-transform:uppercase;letter-spacing:0.08em;";
							walkEl.setAttribute("title", `~${min} min walking from your location`);
							walkEl.innerHTML = `${PERSON_SVG}<span>${min} MIN</span>`;
							nameRow.appendChild(walkEl);
						}
					}

					headerEl.appendChild(nameRow);

					// Whole-header tap → open the bar. Tapping anywhere in the
					// header (empty space, walk chip, name or chevron) navigates,
					// not just the name/chevron. The close button is a separate
					// element painted over the corner, so its clicks never bubble
					// here. The inner anchors keep their href for modified-click
					// new-tab + keyboard activation (Enter dispatches a click that
					// bubbles here for SPA nav).
					if (props.venueId) {
						headerEl.addEventListener("click", (ev) => {
							// Let the browser handle modified clicks on a real anchor
							// (new tab); plain clicks stay SPA + keep the flash.
							if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
							ev.preventDefault();
							nameEl.style.color = "#ED5B1C";
							const chev = headerEl.querySelector<HTMLElement>(".map-popup-chevron");
							if (chev) chev.style.color = "#ED5B1C";
							setTimeout(() => onVenueClickRef.current(props.venueId), 80);
						});
					}
					popupEl.appendChild(headerEl);

					// SCROLL ROWS — each event is a flex row: 36px category disc
					// (color + white icon, same glyph as the marker) on the
					// left, title + mono dateline on the right.
					const scrollEl = document.createElement("div");
					scrollEl.className = "map-popup-scroll";
					scrollEl.style.cssText =
						"max-height:268px;overflow-x:hidden;overflow-y:auto;background:#f8f5ef;";

					evts.forEach((evt, i) => {
						const isLast = i === evts.length - 1;
						const isCanceled = evt.status === "canceled";

						// Real anchor (href=/event/<id>) so Cmd/Ctrl/middle-click opens
						// the event in a new tab, matching the links on the event page.
						const btn = document.createElement("a");
						btn.className = "map-popup-btn";
						btn.setAttribute("href", `/event/${evt.id}`);
						btn.style.cssText =
							`display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:11px 14px;border:none;${isLast ? "" : "border-bottom:1px solid #d2cdc2;"}background:none;cursor:pointer;transition:background 0.12s ease;text-decoration:none;color:inherit;box-sizing:border-box;-webkit-touch-callout:default;`;
						// `--hover-color` drives the row's :hover background in
						// index.css. Setting it per-row lets each event hover in
						// its own category hue.
						btn.style.setProperty("--hover-color", evt.categoryColor);

						// Category disc — matches the marker glyph so the popup
						// row keeps a visual link to the map marker the user
						// just tapped.
						const disc = document.createElement("span");
						disc.className = "map-popup-disc";
						disc.style.cssText =
							`flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:${isCanceled ? "#bbb" : evt.categoryColor};transition:background 0.12s ease;`;
						const iconPaths =
							categoryIconPaths[evt.categoryId] ?? categoryIconPaths["other"];
						disc.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition:stroke 0.12s ease;">${iconPaths}</svg>`;
						btn.appendChild(disc);

						const txtCol = document.createElement("div");
						txtCol.style.cssText = "flex:1 1 auto;min-width:0;";

						if (isCanceled) {
							const badgeRow = document.createElement("div");
							badgeRow.style.cssText = "margin:0 0 4px;line-height:1;";
							const badge = document.createElement("span");
							badge.textContent = "CANCELED";
							badge.style.cssText =
								"display:inline-block;font-family:'Space Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px;font-weight:700;letter-spacing:0.08em;color:#dc2626;background:#fee2e2;padding:1px 5px;";
							badgeRow.appendChild(badge);
							txtCol.appendChild(badgeRow);
						}

						const titleP = document.createElement("p");
						titleP.style.cssText =
							`font-family:'DM Sans',system-ui,sans-serif;font-weight:700;font-size:14px;line-height:1.25;margin:0;color:${isCanceled ? "#888" : "#0f0f0f"};${isCanceled ? "text-decoration:line-through;" : ""}overflow-wrap:anywhere;`;
						titleP.textContent = evt.title;
						txtCol.appendChild(titleP);

						const dateStr = new Date(evt.date + "T00:00:00").toLocaleDateString("en-GB", {
							weekday: "short", day: "numeric", month: "short",
						});

						const metaP = document.createElement("p");
						metaP.className = "map-popup-meta";
						metaP.style.cssText =
							"font-family:'Space Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#6b6b6b;margin:3px 0 0;letter-spacing:0.02em;line-height:1;";

						metaP.appendChild(document.createTextNode(dateStr));

						if (evt.startTime) {
							const sep = document.createElement("span");
							sep.style.cssText = "opacity:0.5;margin:0 5px;";
							sep.textContent = "·";
							metaP.appendChild(sep);
							// Live = currently between startTime and endTime → swap
							// the time text for an "● NOW" indicator with a pulsing
							// orange dot. Mirrors EventMeta on the home page.
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
									"display:inline-block;width:6px;height:6px;border-radius:50%;background:#ED5B1C;animation:ib-pulse 1.6s ease-in-out infinite;";
								nowEl.appendChild(dot);
								nowEl.appendChild(document.createTextNode("NOW"));
								metaP.appendChild(nowEl);
							} else {
								metaP.appendChild(document.createTextNode(evt.startTime));
							}
						}
						txtCol.appendChild(metaP);
						btn.appendChild(txtCol);

						// Trailing chevron — mirrors the venue-name cue so both
						// levels of the popup read as tappable. The event still
						// out-weights the bar visually via its colored disc; this
						// just confirms the row navigates. Flips to white when the
						// row fills with its category color on hover/press.
						const rowChevron = document.createElement("span");
						rowChevron.className = "map-popup-row-chevron";
						rowChevron.style.cssText =
							"flex:0 0 auto;display:inline-flex;align-items:center;color:#6b6b6b;transition:color 0.12s ease;";
						rowChevron.innerHTML = CHEVRON_SVG;
						btn.appendChild(rowChevron);

						btn.addEventListener("click", (ev) => {
							// Let the browser open a new tab on modified clicks; only
							// intercept a plain left-click to stay SPA + keep the flash.
							if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
							ev.preventDefault();
							btn.style.background = evt.categoryColor;
							titleP.style.color = "white";
							metaP.style.color = "rgba(255,255,255,0.8)";
							rowChevron.style.color = "white";
							setTimeout(() => onEventClickRef.current(evt.id), 80);
						});
						scrollEl.appendChild(btn);
					});
					popupEl.appendChild(scrollEl);

					// Shrink-to-wrapped-text — CSS `inline-block + max-width`
					// only collapses around content when the natural (unwrapped)
					// width fits within max-width. Once text wraps, the box
					// stays glued to max-width even if the wrapped lines are
					// narrower. Workaround: measure rendered line widths off-
					// screen, then explicit-set the popup width to the longest
					// line + the surrounding padding. Result: a box that hugs
					// the actual content instead of stretching to 320px.
					document.body.appendChild(popupEl);
					popupEl.style.position = "fixed";
					popupEl.style.left = "-9999px";
					popupEl.style.top = "-9999px";
					popupEl.style.visibility = "hidden";

					// `Element.getClientRects()` on a block element returns ONE
					// rect (its bounding box) — useless for line-by-line text
					// measurement. The Range API instead returns one rect per
					// rendered line of the selected content, which is what we
					// need to find the longest visible line.
					const widestLineIn = (el: Element): number => {
						const r = document.createRange();
						r.selectNodeContents(el);
						const rects = r.getClientRects();
						let max = 0;
						for (let i = 0; i < rects.length; i++) {
							if (rects[i].width > max) max = rects[i].width;
						}
						return max;
					};

					let widestHeaderLine = 0;
					headerEl.querySelectorAll("p, h3").forEach((el) => {
						const w = widestLineIn(el);
						if (w > widestHeaderLine) widestHeaderLine = w;
					});
					let widestRowTextLine = 0;
					popupEl.querySelectorAll(".map-popup-btn p").forEach((p) => {
						const w = widestLineIn(p);
						if (w > widestRowTextLine) widestRowTextLine = w;
					});

					// The venue name is an <a> (so Cmd/Ctrl-click opens a new tab),
					// so the "p, h3" sweep above never measured it. Left out, the
					// box was free to settle at its 300px min-width while a long
					// title got squeezed by what shares its line — narrow enough
					// that overflow-wrap snapped a word mid-letter ("Undergroun" /
					// "d"). Measure the title with mid-word breaking OFF so each word
					// is sized whole. The chevron lives inside nameEl now, so its
					// width is already part of widestNameLine (it sits in the nowrap
					// last-word unit); we only reserve for the far-right walk chip
					// (+10px row gap, absent when out of range) so the box widens,
					// up to the 320 cap, enough to keep words — and the chevron's
					// last-word unit — intact.
					nameEl.style.overflowWrap = "normal";
					const widestNameLine = widestLineIn(nameEl);
					nameEl.style.overflowWrap = "break-word";
					const NAME_ROW_GAP = 10;
					const walkReserve = walkEl
						? walkEl.getBoundingClientRect().width + NAME_ROW_GAP
						: 0;

					// Header padding contribution: 14L + 44R (44R reserves space
					// for the absolutely-positioned close button). Row text-
					// column is offset by 14L padding + 36 disc + 12 gap to text
					// + 12 gap to chevron + 16 chevron + 14R.
					const HEADER_CHROME = 14 + 44;
					const ROW_CHROME = 14 + 36 + 12 + 12 + 16 + 14;
					const computed = Math.max(
						widestHeaderLine + HEADER_CHROME,
						widestNameLine + walkReserve + HEADER_CHROME,
						widestRowTextLine + ROW_CHROME,
						220,
					);
					const finalWidth = Math.min(320, Math.ceil(computed));

					popupEl.style.position = "";
					popupEl.style.left = "";
					popupEl.style.top = "";
					popupEl.style.visibility = "";
					popupEl.style.width = finalWidth + "px";
					document.body.removeChild(popupEl);

					popupRef.current?.remove();
					// Force the popup to always anchor centered above or below
					// the marker, never to the side. With maplibre's default
					// auto-anchor a wide popup near a left/right edge can open
					// half-off-screen on mobile, and the chosen anchor flips
					// unpredictably between markers — confusing for users.
					// Locking to top/bottom keeps the popup's position relative
					// to the marker constant (always "above" or "below"); we
					// just pick which one based on the marker's vertical screen
					// position so the popup opens into open map space.
					const mapRect = map.getContainer().getBoundingClientRect();
					const markerPx = map.project(coords);
					const popupAnchor = markerPx.y < mapRect.height * 0.5 ? "top" : "bottom";

					const popup = new maplibregl.Popup({
						offset: 18,
						maxWidth: "320px",
						anchor: popupAnchor,
					})
						.setLngLat(coords)
						.setDOMContent(popupEl)
						.addTo(map);

					// Horizontal-only auto-pan: with the anchor locked to top
					// or bottom, vertical overflow is already handled by the
					// anchor flip. But a wide popup centered on a marker near
					// the left/right map edge can still spill off-screen, so
					// we measure post-layout and nudge sideways by the
					// overflow pixels.
					requestAnimationFrame(() => {
						const popupRect = popupEl.getBoundingClientRect();
						const margin = 12;
						let dx = 0;
						if (popupRect.left < mapRect.left + margin) {
							dx = popupRect.left - mapRect.left - margin;
						} else if (popupRect.right > mapRect.right - margin) {
							dx = popupRect.right - mapRect.right + margin;
						}
						if (dx !== 0) {
							map.panBy([dx, 0], {
								duration: 320,
								easing: (t) => t * (2 - t),
							});
						}
					});
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
			if (tilesWatchdogId !== null) window.clearTimeout(tilesWatchdogId);
			if (pulseRafId !== null) cancelAnimationFrame(pulseRafId);
			if (mapRef.current === map) {
				map.remove();
				mapRef.current = null;
				sourceReadyRef.current = false;
				// The marker belonged to the now-removed map; drop the ref so the
				// user-location effect recreates it on the rebuilt map instead of
				// calling setLngLat on a detached marker.
				userMarkerRef.current = null;
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

	// User location dot — live-tracked, so it can update many times as the
	// user moves. Reuse the existing marker and just move it (setLngLat) instead
	// of tearing down + recreating the DOM node every fix, which would flicker.
	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;
		if (!userLocation) {
			userMarkerRef.current?.remove();
			userMarkerRef.current = null;
			return;
		}
		if (userMarkerRef.current) {
			userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
			return;
		}
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
		// Always fetch a CURRENT fix rather than flying to a possibly-stale
		// cached position — a "my location" button must mean now. requestLocationFresh
		// stays instant while live-tracking is active (a seconds-fresh fix is
		// already cached at platform level) and only forces a GPS read when stale.
		// On native (Capacitor) the @capacitor/geolocation plugin handles
		// its own availability check, so we skip the navigator-geolocation
		// guard — the WebView has the API but it's a non-functional stub on
		// Android until the plugin bridges it.
		if (!Capacitor.isNativePlatform() && !navigator.geolocation) return;
		setLocating(true);
		const loc = await requestLocationFresh();
		setLocating(false);
		if (!loc) {
			// Three recovery paths: native apps direct to OS app-settings,
			// mobile Safari to iOS Settings → Safari, desktop/Android browsers
			// to the URL bar lock icon. Generic "your browser" works across
			// vendors so we don't mislead Chrome/Firefox users on macOS.
			const isNative = Capacitor.isNativePlatform();
			const nativePlatform = Capacitor.getPlatform();
			const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
			alert(
				isNative
					? nativePlatform === "ios"
						? "Location access was denied.\n\nOpen Settings → Privacy & Security → Location Services → Inside Bars, and allow access."
						: "Location access was denied.\n\nOpen Settings → Apps → Inside Bars → Permissions → Location, and allow access."
					: isIOS
					? "Location access was denied.\n\nOpen Settings → Privacy & Security → Location Services, scroll to your browser, and set it to ‘While Using the App’."
					: "Location access was denied.\n\nClick the location icon in your browser's address bar and allow location, or change it in your browser's site settings."
			);
			return;
		}
		map.flyTo({ center: [loc.lng, loc.lat], zoom: 15, duration: 1200 });
	}

	return (
		<div style={{ position: "absolute", inset: 0 }}>
			<div ref={containerRef} style={{ height: "100%", width: "100%" }} />
			{loadFailed && (
				<div className="absolute inset-0 z-[1000] flex items-center justify-center bg-background px-6">
					{/* Shared ErrorState so a failed map matches the rest of the
					    app's error language instead of a brutalist card. */}
					<ErrorState
						inline
						title="Map could not be loaded"
						message="Weak connection or server unreachable."
						onRetry={() => { autoRetryRef.current = 0; setRetryNonce((n) => n + 1); }}
					/>
				</div>
			)}
			<div
				style={{
					position: "absolute",
					bottom: "var(--fab-bottom)",
					left: 16,
					zIndex: 1000,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 12,
				}}
			>
				<button
					onClick={flyToUser}
					title="My location"
					style={{
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
				<div
					style={{
						width: 44,
						background: "white",
						border: "1.5px solid #d1d5db",
						borderRadius: 22,
						boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
						display: "flex",
						flexDirection: "column",
						overflow: "hidden",
					}}
				>
					<button
						onClick={() => mapRef.current?.zoomIn({ duration: 200 })}
						title="Zoom in"
						style={{
							width: 44,
							height: 44,
							background: "transparent",
							border: "none",
							borderBottom: "1px solid #e5e7eb",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							cursor: "pointer",
							color: "#374151",
						}}
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
							<path d="M12 5v14M5 12h14" />
						</svg>
					</button>
					<button
						onClick={() => mapRef.current?.zoomOut({ duration: 200 })}
						title="Zoom out"
						style={{
							width: 44,
							height: 44,
							background: "transparent",
							border: "none",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							cursor: "pointer",
							color: "#374151",
						}}
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
							<path d="M5 12h14" />
						</svg>
					</button>
				</div>
			</div>
		</div>
	);
}
