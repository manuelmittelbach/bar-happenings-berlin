import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

interface UserLocation {
  lat: number;
  lng: number;
}

export type LocationPermissionStatus = "idle" | "granted" | "denied" | "loading";

const STORAGE_KEY = "bhb-user-location";
const STORAGE_TTL_MS = 30 * 60 * 1000;

function readStoredLocation(): UserLocation | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat: number; lng: number; ts: number };
    if (Date.now() - parsed.ts > STORAGE_TTL_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return { lat: parsed.lat, lng: parsed.lng };
  } catch {
    return null;
  }
}

function writeStoredLocation(loc: UserLocation) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loc, ts: Date.now() }));
  } catch {
    // ignore quota / private-mode errors
  }
}

// Module-level cache so geolocation is only requested once across all components.
// Seed from sessionStorage so a page reload doesn't lose distances until the
// browser permission check + getCurrentPosition round-trip completes.
let cached: UserLocation | null = typeof window !== "undefined" ? readStoredLocation() : null;
// Permission starts UNKNOWN, never inferred from a cached fix. A stored
// position only means "we located the user at some point", NOT that the
// browser permission is still granted — on mobile it silently reverts to
// "prompt" per session. Seeding "granted" off the cache made the live-watch
// fire an unsolicited popup and the locate button return a stale position.
// The real state is established via navigator.permissions.query / a fresh fix.
let permissionStatus: LocationPermissionStatus = "idle";
const subscribers = new Set<(loc: UserLocation | null) => void>();
const statusSubscribers = new Set<(status: LocationPermissionStatus) => void>();

function notifyStatus(s: LocationPermissionStatus) {
  permissionStatus = s;
  statusSubscribers.forEach((fn) => fn(s));
}

export function triggerLocationRequest() {
  if (permissionStatus === "granted" || permissionStatus === "loading") return;

  // Native (Capacitor) path — the @capacitor/geolocation plugin bridges
  // to CoreLocation (iOS) and FusedLocationProviderClient (Android). On
  // Android the WebView's navigator.geolocation does NOT auto-bridge, so
  // calling it directly silently denies; we have to go through the plugin.
  // The plugin's getCurrentPosition shows the OS-native permission dialog
  // on first call and returns the cached decision afterwards.
  if (Capacitor.isNativePlatform()) {
    notifyStatus("loading");
    Geolocation.getCurrentPosition({ timeout: 8000, maximumAge: 5 * 60 * 1000 })
      .then((pos) => {
        cached = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        writeStoredLocation(cached);
        notifyStatus("granted");
        subscribers.forEach((fn) => fn(cached));
      })
      .catch(() => {
        notifyStatus("denied");
        subscribers.forEach((fn) => fn(null));
      });
    return;
  }

  if (!navigator.geolocation) {
    notifyStatus("denied");
    return;
  }

  notifyStatus("loading");

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      cached = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      writeStoredLocation(cached);
      notifyStatus("granted");
      subscribers.forEach((fn) => fn(cached));
    },
    () => {
      notifyStatus("denied");
      subscribers.forEach((fn) => fn(null));
    },
    { timeout: 8000, maximumAge: 5 * 60 * 1000 }
  );
}

// --- Live tracking (watchPosition) -----------------------------------------
// getCurrentPosition above resolves a single fix; watchPosition keeps firing as
// the device moves so the blue dot follows the user like Google Maps. We
// reference-count watchers (the Map page is the only consumer today, but a
// second mount shouldn't open a second OS watch) and tear the watch down when
// the last watcher unmounts so we don't drain battery off-screen.
let watchActive = false;
let watchCount = 0;
let webWatchId: number | null = null;
let nativeWatchId: string | null = null;

function publishPosition(lat: number, lng: number) {
  cached = { lat, lng };
  writeStoredLocation(cached);
  // A successful watch fix means permission is granted — flip the status if a
  // prior getCurrentPosition hadn't already (e.g. watch was the first ask).
  if (permissionStatus !== "granted") notifyStatus("granted");
  subscribers.forEach((fn) => fn(cached));
}

function startWatch() {
  if (watchActive) return;
  watchActive = true;

  if (Capacitor.isNativePlatform()) {
    Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 10000 },
      (pos, err) => {
        // Transient errors (lost signal, indoors) just skip a frame — we keep
        // the last known dot rather than dropping it to "denied".
        if (err || !pos) return;
        publishPosition(pos.coords.latitude, pos.coords.longitude);
      },
    )
      .then((id) => {
        // If stopWatch ran before the plugin resolved the id, clear it now so
        // we don't leak a watch with no handle.
        if (!watchActive) {
          Geolocation.clearWatch({ id });
          return;
        }
        nativeWatchId = id;
      })
      .catch(() => {
        watchActive = false;
      });
    return;
  }

  if (!navigator.geolocation) {
    watchActive = false;
    return;
  }

  webWatchId = navigator.geolocation.watchPosition(
    (pos) => publishPosition(pos.coords.latitude, pos.coords.longitude),
    () => {
      // Keep the last known position on transient errors; only an explicit
      // permission revocation surfaces via permissions.query elsewhere.
    },
    // maximumAge: 0 forces fresh fixes so the dot tracks real movement instead
    // of replaying a cached point.
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
  );
}

function stopWatch() {
  watchActive = false;
  if (webWatchId !== null) {
    navigator.geolocation.clearWatch(webWatchId);
    webWatchId = null;
  }
  if (nativeWatchId !== null) {
    Geolocation.clearWatch({ id: nativeWatchId });
    nativeWatchId = null;
  }
}

// Always resolves a CURRENT fix — never the (possibly 30-min-old) cache. Used
// by the locate button, where "take me to where I am now" must mean now.
// maximumAge: 10000 keeps it instant while live-tracking is running (the
// platform already holds a seconds-fresh fix) but forces a fresh GPS read when
// the known position is stale. On web a missing permission surfaces the OS
// popup here — which is correct, since the user just tapped the button.
// publishPosition flips the status to "granted" on success, so a button grant
// also (re)starts the live watch via its status subscriber.
export function requestLocationFresh(): Promise<UserLocation | null> {
  return new Promise((resolve) => {
    if (Capacitor.isNativePlatform()) {
      notifyStatus("loading");
      Geolocation.getCurrentPosition({ timeout: 8000, maximumAge: 10000 })
        .then((pos) => {
          publishPosition(pos.coords.latitude, pos.coords.longitude);
          resolve(cached);
        })
        .catch(() => {
          notifyStatus("denied");
          subscribers.forEach((fn) => fn(null));
          resolve(null);
        });
      return;
    }

    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    notifyStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        publishPosition(pos.coords.latitude, pos.coords.longitude);
        resolve(cached);
      },
      () => {
        notifyStatus("denied");
        subscribers.forEach((fn) => fn(null));
        resolve(null);
      },
      { timeout: 8000, maximumAge: 10000 },
    );
  });
}

export function useUserLocation(opts?: { watch?: boolean }): {
  location: UserLocation | null;
  status: LocationPermissionStatus;
  request: () => void;
} {
  const watch = opts?.watch ?? false;
  const [location, setLocation] = useState<UserLocation | null>(cached);
  const [status, setStatus] = useState<LocationPermissionStatus>(permissionStatus);

  useEffect(() => {
    subscribers.add(setLocation);
    statusSubscribers.add(setStatus);

    // Native (Capacitor) apps prompt for location on first mount — the
    // iOS system permission dialog is the expected onboarding UX in a
    // native app, and without an early ask Nearby Events would stay
    // empty until the user happened to find the Map tab's locate button.
    // The trigger is a no-op once permission resolves (granted/denied),
    // so re-mounts after onboarding don't re-prompt.
    if (Capacitor.isNativePlatform()) {
      triggerLocationRequest();
    }
    // For first-time web visitors we never auto-trigger getCurrentPosition on
    // mount: iOS Safari would surface its "Would you like to allow access"
    // popup as soon as the page loads, which is confusing UX.
    //
    // But once the user has granted permission, the popup is gone forever, so
    // refreshing the location silently on mount is safe — and necessary, since
    // a hard reload otherwise loses the in-memory cache and distances vanish
    // until the user clicks the banner or the map's locate button again.
    else if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" })
        .then((result) => {
          if (result.state === "denied") {
            notifyStatus("denied");
          } else if (result.state === "granted") {
            triggerLocationRequest();
          }
        })
        .catch((err) => {
          console.debug("[useUserLocation] permissions.query rejected", err);
        });
    }

    return () => {
      subscribers.delete(setLocation);
      statusSubscribers.delete(setStatus);
    };
  }, []);

  // Live tracking: while a consumer opts into `watch`, follow the device via
  // watchPosition so the dot moves as the user does. We never start the watch
  // until permission is granted — on web that keeps watchPosition from firing
  // its own permission popup before the user has asked for location.
  useEffect(() => {
    if (!watch) return;
    watchCount++;

    const onStatus = (s: LocationPermissionStatus) => {
      if (s === "granted") startWatch();
    };
    statusSubscribers.add(onStatus);

    // Start the watch ONLY when permission is really granted — never just
    // because a cached fix made `permissionStatus` assume it is. On mobile
    // (esp. iOS Safari) the browser permission is often per-session and
    // silently reverts to "prompt" while our 30-min cache still says
    // "granted"; trusting that cache made watchPosition fire and surface an
    // unsolicited permission popup the user never asked for.
    if (Capacitor.isNativePlatform()) {
      // Native: trust the plugin status (its own dialog is the intended UX).
      if (permissionStatus === "granted") startWatch();
    } else if (navigator.permissions) {
      // Web: ask the browser for the real state instead of believing the cache.
      navigator.permissions.query({ name: "geolocation" })
        .then((result) => {
          if (result.state === "granted") startWatch();
          // "prompt" / "denied" → do nothing → no ungated watchPosition popup.
          // The watch still starts later via onStatus once the user grants
          // explicitly through the locate button.
        })
        .catch(() => {
          // Permissions API unsupported — stay silent and wait for an explicit
          // grant via onStatus rather than risk an unsolicited popup.
        });
    }

    return () => {
      statusSubscribers.delete(onStatus);
      watchCount = Math.max(0, watchCount - 1);
      if (watchCount === 0) stopWatch();
    };
  }, [watch]);

  return { location, status, request: triggerLocationRequest };
}
