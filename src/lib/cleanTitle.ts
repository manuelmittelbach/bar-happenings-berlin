/**
 * Remove the venue name from the event title to avoid redundancy,
 * since the venue is always displayed separately.
 * Handles patterns like "Event Name – Venue", "Event Name - Venue", "Event Name @ Venue",
 * "Event Name at Venue", "Event Name | Venue", "Event Name || Venue"
 */
export function cleanEventTitle(title: string, venue: string): string {
  if (!venue || !title) return title;

  // Common separators: " – ", " - ", " @ ", " at ", " | ", " || "
  const separators = [' – ', ' - ', ' || ', ' | ', ' @ ', ' at '];

  for (const sep of separators) {
    const idx = title.toLowerCase().lastIndexOf(sep.toLowerCase());
    if (idx === -1) continue;

    const afterSep = title.slice(idx + sep.length).trim();
    // Check if what's after the separator matches the venue name (fuzzy)
    if (isFuzzyMatch(afterSep, venue)) {
      return title.slice(0, idx).trim();
    }
  }

  return title;
}

function isFuzzyMatch(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const na = normalize(a);
  const nb = normalize(b);
  // Exact match or one contains the other
  return na === nb || nb.includes(na) || na.includes(nb);
}

/**
 * Insert soft hyphens (­) at safe break points inside long words so
 * unbreakable CamelCase mashups ("JazzformationJustFriends") split with a
 * visible "-" at a meaningful boundary instead of mid-character via
 * `overflow-wrap:anywhere` ("JazzformationJu / stFriends"). Soft hyphens
 * are invisible unless the browser actually breaks at them, so titles
 * that fit on one line stay untouched.
 *
 * We only break before an uppercase letter that follows a lowercase
 * letter — a heuristic that's safe for proper names with spaces ("TAMARA
 * LUKASHEVA") because they don't contain CamelCase boundaries, so this
 * function never breaks them mid-name. Browser `hyphens: auto` is left
 * off elsewhere for the same reason; this targets the one case it can't
 * handle (no-space compound run-ons).
 */
export function addSoftHyphens(text: string): string {
  if (!text) return text;
  return text.replace(/([a-zäöüß])(?=[A-ZÄÖÜ])/g, "$1­");
}
