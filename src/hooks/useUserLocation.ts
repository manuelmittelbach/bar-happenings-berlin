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

const CONSENT_STORAGE_KEY = "bhb-geo-consent";

function readStoredConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_STORAGE_KEY) === "granted";
  } catch {
    return false;
  }
}

function writeStoredConsent(granted: boolean) {
  try {
    if (granted) localStorage.setItem(CONSENT_STORAGE_KEY, "granted");
    else localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    // quota / disabled — silent
  }
}

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
      writeStoredConsent(true);
      notifyStatus("granted");
      subscribers.forEach((fn) => fn(cached));
    },
    () => {
      writeStoredConsent(false);
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

    // Primary path: persisted consent flag. Survives refresh on Safari/iOS
    // where navigator.permissions.query for geolocation is unreliable.
    if (permissionStatus === "idle" && readStoredConsent()) {
      triggerLocationRequest();
    }

    // Secondary signal: keep state in sync if the browser explicitly knows
    // the permission outcome (handles user revoking via browser settings).
    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" })
        .then((result) => {
          if (result.state === "denied") {
            writeStoredConsent(false);
            notifyStatus("denied");
          } else if (result.state === "granted" && permissionStatus === "idle") {
            triggerLocationRequest();
          }
        })
        .catch((err) => {
          // permissions.query can reject on Safari private mode, strict tracking
          // protection, or older mobile browsers — the localStorage path above
          // already handles the "previously granted" case.
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
