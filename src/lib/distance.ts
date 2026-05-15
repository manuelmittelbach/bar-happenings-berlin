import type { BarlinEvent, Venue } from "@/types/event";

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function walkingMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 80));
}

/* Compute (event, walking-minutes) tuples for events whose venue is within
 * `maxWalkingMin` of `userLocation`, sorted nearest-first and capped at
 * `limit`. Pure function — shared by the Index "Nearby tonight" strip and
 * by Index's "More tonight" dedupe so a card never appears in both.
 */
export function computeNearbyEvents(
  events: BarlinEvent[],
  venueMap: Map<string, Venue>,
  userLocation: { lat: number; lng: number },
  maxWalkingMin = 15,
  limit = 6,
): { event: BarlinEvent; min: number }[] {
  const withDistance: { event: BarlinEvent; min: number }[] = [];
  for (const e of events) {
    const v = venueMap.get(e.venueId);
    if (!v) continue;
    if (typeof v.lat !== "number" || typeof v.lng !== "number") continue;
    if (!Number.isFinite(v.lat) || !Number.isFinite(v.lng)) continue;
    const meters = haversineMeters(userLocation.lat, userLocation.lng, v.lat, v.lng);
    const min = walkingMinutes(meters);
    if (min > maxWalkingMin) continue;
    withDistance.push({ event: e, min });
  }
  withDistance.sort((a, b) => a.min - b.min);
  return withDistance.slice(0, limit);
}
