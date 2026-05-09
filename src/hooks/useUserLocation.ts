import { useState, useEffect } from "react";

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
let permissionStatus: LocationPermissionStatus = cached ? "granted" : "idle";
const subscribers = new Set<(loc: UserLocation | null) => void>();
const statusSubscribers = new Set<(status: LocationPermissionStatus) => void>();

function notifyStatus(s: LocationPermissionStatus) {
  permissionStatus = s;
  statusSubscribers.forEach((fn) => fn(s));
}

export function triggerLocationRequest() {
  if (permissionStatus === "granted" || permissionStatus === "loading") return;
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

export function requestLocationOnce(): Promise<UserLocation | null> {
  if (permissionStatus === "granted" && cached) return Promise.resolve(cached);
  if (permissionStatus === "denied") return Promise.resolve(null);

  return new Promise((resolve) => {
    const listener = (s: LocationPermissionStatus) => {
      if (s === "granted" || s === "denied") {
        statusSubscribers.delete(listener);
        resolve(s === "granted" ? cached : null);
      }
    };
    statusSubscribers.add(listener);
    triggerLocationRequest();
  });
}

export function useUserLocation(): {
  location: UserLocation | null;
  status: LocationPermissionStatus;
  request: () => void;
} {
  const [location, setLocation] = useState<UserLocation | null>(cached);
  const [status, setStatus] = useState<LocationPermissionStatus>(permissionStatus);

  useEffect(() => {
    subscribers.add(setLocation);
    statusSubscribers.add(setStatus);

    // For first-time visitors we never auto-trigger getCurrentPosition on
    // mount: iOS Safari would surface its "Would you like to allow access"
    // popup as soon as the page loads, which is confusing UX.
    //
    // But once the user has granted permission, the popup is gone forever, so
    // refreshing the location silently on mount is safe — and necessary, since
    // a hard reload otherwise loses the in-memory cache and distances vanish
    // until the user clicks the banner or the map's locate button again.
    if (navigator.permissions) {
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

  return { location, status, request: triggerLocationRequest };
}
