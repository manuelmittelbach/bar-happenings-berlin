import { useCallback, useEffect, useMemo, useReducer } from "react";
import { useCategories } from "@/hooks/useEvents";

/**
 * Filter state for Index (list) and MapPage. Lives in sessionStorage so
 * navigating List ↔ Map (or List ↔ event detail ↔ List) preserves the
 * selection within a session. Full page reloads start fresh — this
 * module is only re-evaluated on a real reload, and the top-level
 * `removeItem` block below runs each time, clearing previous values.
 *
 * Why not URL params: filter chips reset on reload now (the user's
 * mental model), and the URL stays clean (`/`, `/map`) without
 * `?d=&c=&q=` baggage.
 */

const KEYS = {
  searchQuery: "filter_q",
  activeCategory: "filter_c",
  activeNeighborhood: "filter_hood",
  activeDate: "filter_d",
} as const;

const DEFAULTS = {
  searchQuery: "",
  activeCategory: "",
  activeNeighborhood: "",
  activeDate: "Tonight",
} as const;

type FilterKey = keyof typeof KEYS;

// Reload-clear: this module is evaluated once per JS context. SPA
// navigation re-uses the existing context (keep state), but a real
// page reload boots a fresh context and re-runs this — wiping the
// stored filters back to defaults.
if (typeof sessionStorage !== "undefined") {
  for (const k of Object.values(KEYS)) sessionStorage.removeItem(k);
}

function readKey(k: FilterKey): string {
  if (typeof sessionStorage === "undefined") return DEFAULTS[k];
  return sessionStorage.getItem(KEYS[k]) ?? DEFAULTS[k];
}

function writeKey(k: FilterKey, value: string) {
  if (typeof sessionStorage === "undefined") return;
  if (value === DEFAULTS[k] || value === "") sessionStorage.removeItem(KEYS[k]);
  else sessionStorage.setItem(KEYS[k], value);
}

// Tiny pub/sub. sessionStorage doesn't emit events for same-tab
// writes, so any consumer that wants to react to a setFilter call
// from outside its own hook (e.g. Footer setting a category before
// navigating) needs an in-memory notifier.
const listeners = new Set<() => void>();
function notify() { listeners.forEach((l) => l()); }

/** Direct setter for non-React contexts (Footer category links). */
export function setFilter(k: FilterKey, value: string) {
  writeKey(k, value);
  notify();
}

export function useFilterParams() {
  const { data: categories } = useCategories();
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    listeners.add(force);
    return () => { listeners.delete(force); };
  }, []);

  const searchQuery = readKey("searchQuery");
  const activeCategoryRaw = readKey("activeCategory");
  const activeNeighborhood = readKey("activeNeighborhood");
  const activeDate = readKey("activeDate");

  const setSearchQuery = useCallback((v: string) => { writeKey("searchQuery", v); notify(); }, []);
  const setActiveCategory = useCallback((v: string) => { writeKey("activeCategory", v); notify(); }, []);
  const setActiveNeighborhood = useCallback((v: string) => { writeKey("activeNeighborhood", v); notify(); }, []);
  const setActiveDate = useCallback((v: string) => { writeKey("activeDate", v); notify(); }, []);

  // Invalid stored slugs (renamed/deleted categories from a previous
  // session) silently fall back to "no filter" once category data has
  // loaded — otherwise the chip strip shows nothing active while
  // quietly returning zero results.
  const activeCategory =
    activeCategoryRaw && categories && !categories.some((c) => c.id === activeCategoryRaw)
      ? ""
      : activeCategoryRaw;

  return useMemo(
    () => ({
      searchQuery, setSearchQuery,
      activeCategory, setActiveCategory,
      activeNeighborhood, setActiveNeighborhood,
      activeDate, setActiveDate,
    }),
    [
      searchQuery, activeCategory, activeNeighborhood, activeDate,
      setSearchQuery, setActiveCategory, setActiveNeighborhood, setActiveDate,
    ],
  );
}
