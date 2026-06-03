/**
 * Normalize a string for fuzzy matching:
 * - lowercase
 * - remove diacritics
 * - strip hyphens, dots, apostrophes
 * - collapse multiple spaces
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[-'.]/g, " ")          // hyphens/dots/apostrophes → space
    .replace(/\s+/g, " ")            // collapse spaces
    .trim();
}

/**
 * Check if `text` fuzzy-matches `query`.
 * - Normalizes both strings (case, diacritics, hyphens, etc.)
 * - Each query word must be a PREFIX of some word in the normalized text.
 *   Prefix (not substring) so a stray single letter like the "r" in
 *   "Alter r" can't match the "r" buried inside "alteR" — it has to start
 *   a word. "Alter Schwede" no longer matches "Alter r"; "Alter Roter" does.
 */
export function fuzzyMatch(text: string, query: string): boolean {
  const textWords = normalize(text).split(" ").filter(Boolean);
  const queryWords = normalize(query).split(" ").filter(Boolean);
  return queryWords.every((q) =>
    textWords.some((t) => t.startsWith(q)),
  );
}

/**
 * Check if any of the given fields fuzzy-match the query.
 */
export function fuzzyMatchAny(fields: string[], query: string): boolean {
  const joined = fields.join(" ");
  return fuzzyMatch(joined, query);
}
