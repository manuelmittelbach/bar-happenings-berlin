export const ENTRY_AMOUNTS = Array.from({ length: 100 }, (_, i) => (i + 1) * 0.5).map((n) =>
  Number.isInteger(n) ? `${n} €` : `${Math.floor(n)},50 €`,
);

export const PREDEFINED_ENTRY_OPTIONS = new Set<string>(["Free", "Pay what you want", ...ENTRY_AMOUNTS]);

export const CUSTOM_ENTRY_SENTINEL = "__custom__";
