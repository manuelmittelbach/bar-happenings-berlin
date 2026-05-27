// Pure helpers for the split venue-address fields (name / street / PLZ / city)
// shared by the publish form and the admin "edit the new bar" panel.

export interface VenueFields {
  name: string;
  street: string;
  plz: string;
  city: string;
}

/** Combine the split fields into the stored free-text address: "Street, PLZ City". */
export function buildVenueAddress(v: Pick<VenueFields, "street" | "plz" | "city">): string {
  const tail = [v.plz.trim(), v.city.trim()].filter(Boolean).join(" ");
  return [v.street.trim(), tail].filter(Boolean).join(", ");
}

/** Best-effort inverse of buildVenueAddress, to prefill the split fields when an
 * admin edits an already-combined address ("Street, PLZ City[, Germany]"). */
export function parseVenueAddress(address: string, name: string): VenueFields {
  const plzMatch = address.match(/\b(\d{5})\b/);
  const plz = plzMatch?.[1] ?? "";
  const firstComma = address.indexOf(",");
  const street = (
    firstComma >= 0
      ? address.slice(0, firstComma)
      : plzMatch?.index != null
        ? address.slice(0, plzMatch.index)
        : address
  ).trim();
  let city = "";
  if (plzMatch?.index != null) {
    city = address
      .slice(plzMatch.index + plz.length)
      .replace(/^[\s,]+/, "")
      .replace(/,?\s*(germany|deutschland)\s*$/i, "")
      .trim();
  }
  return { name, street, plz, city };
}
