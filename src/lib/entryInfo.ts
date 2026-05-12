/**
 * Helpers for classifying an event's `entryInfo` string.
 *
 * Entry info is free-form text in the DB (e.g. "Free", "5 €", "Donation",
 * "Tickets via Eventim"), so semantic checks have to live in one place —
 * otherwise the homepage filter, the entry filter, and the FREE badge all
 * drift apart over time.
 *
 * Canonical donation value is `"Donation"`. Legacy values
 * (`"Pay what you want"`, `"Frei / Spende"`, freitext containing "spende"
 * or "die band sammelt") were migrated in the DB. New writes are
 * normalized at the storage boundary via `normalizeEntryInfoForDb` so the
 * classifier below only needs to check the canonical string.
 */

export function isFreeEntry(info: string): boolean {
  return info === "Free";
}

export function isDonationEntry(info: string): boolean {
  return info === "Donation";
}

/** True for both Free and Donation events — the universal "no fixed cost"
 *  filter used by the FreeTonight homepage section. */
export function isFreeOrDonation(info: string): boolean {
  return isFreeEntry(info) || isDonationEntry(info);
}

/**
 * Parse a price like "5 €" or "0,5 €" into a number. Returns null for
 * strings that aren't a plain euro amount (Free, Donation, etc.).
 */
export function parseEntryEuro(s: string): number | null {
  const m = s.match(/^(\d+)(?:,(\d{1,2}))?\s*€$/);
  if (!m) return null;
  const whole = parseInt(m[1], 10);
  const frac = m[2] ? parseInt(m[2], 10) / Math.pow(10, m[2].length) : 0;
  return whole + frac;
}

/**
 * Normalize an `entryInfo` value before writing it to the DB. Rewrites
 * donation-class variants (legacy canonicals + German keywords) to the
 * canonical `"Donation"`. Other values pass through untouched (after
 * trimming) so freitext like `"Tickets via Eventim"` stays verbatim. Used
 * at every event insert/update path in `supabaseQueries.ts` and mirrors
 * `normalize_entry_info()` in `scripts/scrape_helpers.py`.
 */
export function normalizeEntryInfoForDb(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) return "";
  const lower = cleaned.toLowerCase();
  if (
    cleaned === "Pay what you want"
    || cleaned === "Frei / Spende"
    || lower.includes("spende")
    || lower.includes("die band sammelt")
  ) {
    return "Donation";
  }
  return cleaned;
}
