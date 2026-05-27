import type { Venue } from "@/types/event";

/* Client-side duplicate detection for manually-entered event venues. When a
 * plain user types a location instead of picking one from the directory, an
 * admin approving the event needs to know whether that bar already exists —
 * otherwise approving would create a near-duplicate venue. This matcher is
 * intentionally conservative (exact / substring on normalized values): linking
 * to the WRONG bar is worse than leaving a near-duplicate the admin can merge
 * later, so we'd rather miss a fuzzy match than surface a false one. No fuzzy
 * dependency — if broader recall is needed later, add a Levenshtein threshold
 * on the normalized name. */

export type MatchReason = "name" | "address" | "both";

export interface VenueMatch {
  venue: Venue;
  reason: MatchReason;
}

/** Lowercase (German-aware), strip diacritics, reduce to alphanumeric tokens. */
function normalize(s: string): string {
  return s
    .toLocaleLowerCase("de")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Two normalized strings "match" when they're equal or one contains the other. */
function softEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

const PLZ_RE = /\b(\d{5})\b/;

function extractPlz(address: string): string {
  return address.match(PLZ_RE)?.[1] ?? "";
}

/** House number = first number token that isn't the 5-digit PLZ. */
function extractHouseNo(address: string): string {
  const plz = extractPlz(address);
  for (const m of address.matchAll(/\b(\d{1,4}[a-z]?)\b/gi)) {
    if (m[1] !== plz) return m[1].toLowerCase();
  }
  return "";
}

function addressMatches(a: string, b: string): boolean {
  if (softEqual(normalize(a), normalize(b))) return true;
  // Fall back to street-number + PLZ so "Schönhauser Allee 12, 10435 Berlin"
  // matches a stored "Schönhauser Allee 12" regardless of trailing city.
  const plzA = extractPlz(a);
  const plzB = extractPlz(b);
  if (plzA && plzA === plzB) {
    const hnA = extractHouseNo(a);
    const hnB = extractHouseNo(b);
    if (hnA && hnA === hnB) return true;
  }
  return false;
}

/** Likely existing-venue matches for a manually-typed name + address, ranked
 * "both" → "name" → "address", deduped by venue id. */
export function findVenueMatches(
  name: string,
  address: string,
  venues: Venue[],
): VenueMatch[] {
  const normName = normalize(name);
  const matches: VenueMatch[] = [];

  for (const venue of venues) {
    const nameHit = !!normName && softEqual(normName, normalize(venue.name));
    const addrHit = !!address.trim() && addressMatches(address, venue.address);
    if (!nameHit && !addrHit) continue;
    matches.push({
      venue,
      reason: nameHit && addrHit ? "both" : nameHit ? "name" : "address",
    });
  }

  const rank: Record<MatchReason, number> = { both: 0, name: 1, address: 2 };
  return matches.sort((a, b) => rank[a.reason] - rank[b.reason]);
}
