/**
 * Helpers for classifying an event's `entryInfo` string.
 *
 * Entry info is free-form text in the DB. Donation classification depends
 * on the canonical `"Donation"` string — both the form dropdown and the
 * scraper LLM prompt are responsible for producing that value. Anything
 * else (including freitext like `"Spendenbasis"` if the LLM doesn't map
 * it) stays verbatim and won't be classified as Donation.
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
