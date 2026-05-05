import { useState, useEffect } from "react";

interface UserLocation {
  lat: number;
  lng: number;
}

export type LocationPermissionStatus = "idle" | "granted" | "denied" | "loading";

// Module-level cache so geolocation is only requested once across all components
let cached: UserLocation | null = null;
let permissionStatus: LocationPermissionStatus = "idle";
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

    // No auto-trigger of getCurrentPosition on mount. The location prompt
    // must be initiated by an explicit user action (banner click), otherwise
    // iOS Safari surfaces its "Would you like to allow access" popup as soon
    // as the page loads — confusing UX for first-time visitors.
    //
    // Still sync with the browser's permission state to detect denial: if the
    // user revoked geolocation via browser settings, the banner should hide
    // (clicking it wouldn't do anything anyway). We do NOT auto-trigger on
    // "granted" — the user still has to confirm via the banner.
    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" })
        .then((result) => {
          if (result.state === "denied") {
            notifyStatus("denied");
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
