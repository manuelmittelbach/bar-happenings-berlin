import { useState, useEffect } from "react";

interface UserLocation {
  lat: number;
  lng: number;
}

// Module-level cache so geolocation is only requested once across all components
let cached: UserLocation | null = null;
let requested = false;
const subscribers = new Set<(loc: UserLocation | null) => void>();

function requestLocation() {
  if (requested) return;
  requested = true;

  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      cached = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      subscribers.forEach((fn) => fn(cached));
    },
    () => {
      subscribers.forEach((fn) => fn(null));
    },
    { timeout: 8000, maximumAge: 5 * 60 * 1000 }
  );
}

export function useUserLocation(): UserLocation | null {
  const [location, setLocation] = useState<UserLocation | null>(cached);

  useEffect(() => {
    if (cached) return;
    subscribers.add(setLocation);
    requestLocation();
    return () => { subscribers.delete(setLocation); };
  }, []);

  return location;
}
