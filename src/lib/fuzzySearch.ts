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
 * - Each query word must appear as a substring in the normalized text
 */
export function fuzzyMatch(text: string, query: string): boolean {
  const normalizedText = normalize(text);
  const words = normalize(query).split(" ").filter(Boolean);
  return words.every((w) => normalizedText.includes(w));
}

/**
 * Check if any of the given fields fuzzy-match the query.
 */
export function fuzzyMatchAny(fields: string[], query: string): boolean {
  const joined = fields.join(" ");
  return fuzzyMatch(joined, query);
}
