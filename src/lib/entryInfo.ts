/**
 * Helpers for classifying an event's `entryInfo` string.
 *
 * Entry info is free-form text in the DB (e.g. "Free", "5 €", "Pay what you
 * want", "Frei / Spende", "Die Band sammelt am Ende"), so semantic checks
 * have to live in one place — otherwise the homepage filter, the entry
 * filter, and the FREE badge all drift apart over time.
 */

export function isFreeEntry(info: string): boolean {
  return info === "Free";
}

/**
 * "Pay what you want" includes the explicit string AND the German
 * "Frei / Spende" (donation-implied) and free-text variants like
 * "Die Band sammelt am Ende". Semantically these all mean: optional
 * payment, no fixed price, won't be turned away for refusing.
 */
export function isPayWhatYouWantEntry(info: string): boolean {
  return (
    info === "Pay what you want"
    || info === "Frei / Spende"
    || info.toLowerCase().includes("die band sammelt")
  );
}

/** True for both Free and Pay-what-you-want events — the universal "no
 *  fixed cost" filter used by the FreeTonight homepage section. */
export function isFreeOrDonation(info: string): boolean {
  return isFreeEntry(info) || isPayWhatYouWantEntry(info);
}

/**
 * Parse a price like "5 €" or "0,5 €" into a number. Returns null for
 * strings that aren't a plain euro amount (Free, Pay-what-you-want, etc.).
 */
export function parseEntryEuro(s: string): number | null {
  const m = s.match(/^(\d+)(?:,(\d{1,2}))?\s*€$/);
  if (!m) return null;
  const whole = parseInt(m[1], 10);
  const frac = m[2] ? parseInt(m[2], 10) / Math.pow(10, m[2].length) : 0;
  return whole + frac;
}
