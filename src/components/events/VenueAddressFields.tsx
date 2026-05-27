import { deriveNeighborhood } from "@/lib/neighborhoodFromAddress";
import type { VenueFields } from "@/lib/venueAddress";

// Shared venue-address subform used by the plain-user publish flow (EventForm
// "Enter manually") AND the admin "edit the new bar" panel, so both look and
// behave identically. Same labels/inputs as the bar-signup form.
const inputClass =
  "w-full h-11 px-3 bg-background border-2 border-foreground font-serif text-base outline-none focus:bg-card transition-colors placeholder:text-foreground/30";
const labelClass =
  "font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55";

export default function VenueAddressFields({
  value,
  onChange,
}: {
  value: VenueFields;
  onChange: (next: VenueFields) => void;
}) {
  const set = (patch: Partial<VenueFields>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className={labelClass}>Venue name <span className="text-accent">*</span></label>
        <input
          type="text"
          value={value.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Zum Goldenen Hahn"
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <label className={labelClass}>Street and house number <span className="text-accent">*</span></label>
        <input
          type="text"
          value={value.street}
          onChange={(e) => set({ street: e.target.value })}
          placeholder="Schönhauser Allee 12"
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <label className={labelClass}>Postal code <span className="text-accent">*</span></label>
        <input
          type="text"
          value={value.plz}
          onChange={(e) => set({ plz: e.target.value })}
          placeholder="10435"
          className={inputClass}
        />
        {value.plz.trim().length === 5 && (
          <p className="text-xs text-muted-foreground">
            Neighborhood: {deriveNeighborhood(value.street, value.plz) || "Unknown — we'll confirm on review"}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <label className={labelClass}>City <span className="text-accent">*</span></label>
        <input
          type="text"
          value={value.city}
          onChange={(e) => set({ city: e.target.value })}
          placeholder="Berlin"
          className={inputClass}
        />
      </div>
    </div>
  );
}
