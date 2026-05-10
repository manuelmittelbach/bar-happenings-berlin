import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useCategories } from "@/hooks/useEvents";

/**
 * Single source of truth for shared filter state across Index and MapPage.
 * State lives in the URL (?q=&c=&hood=&d=&e=). Defaults are NOT written to
 * the URL — clicking "All" on Date or Entry removes the param so empty state
 * stays clean (just `/`). Updates use `replace: true` so each filter toggle
 * replaces the current history entry instead of stacking — back-button skips
 * over filter changes and goes to the previous real page.
 *
 * Invalid `?c=` slugs (typos, renamed categories, stale bookmarks) are treated
 * as "no filter" once category data has loaded — otherwise the chip strip
 * shows nothing active while quietly returning zero results.
 */
export function useFilterParams() {
  const [params, setParams] = useSearchParams();
  const { data: categories } = useCategories();

  const setParam = useCallback(
    (key: string, value: string, defaultValue: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === defaultValue || value === "") next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const rawCategory = params.get("c") ?? "";
  // Until categories are loaded, surface the raw value (best-effort, avoids
  // a flash of "no filter" on page load with a valid slug).
  const activeCategory =
    rawCategory && categories && !categories.some((c) => c.id === rawCategory)
      ? ""
      : rawCategory;

  // Entry budget: 0..19 = price cap in euros (0 = Free / PWYW only); 20 = Max
  // (no cap, default). Anything outside that range — including legacy values
  // like "All" / "Free" / "0-5 €" from older URLs — falls back to 20.
  const rawEntry = params.get("e");
  const parsedEntry = rawEntry === null ? 20 : parseInt(rawEntry, 10);
  const activeEntry =
    Number.isFinite(parsedEntry) && parsedEntry >= 0 && parsedEntry <= 19
      ? parsedEntry
      : 20;

  return useMemo(
    () => ({
      searchQuery: params.get("q") ?? "",
      setSearchQuery: (v: string) => setParam("q", v, ""),
      activeCategory,
      setActiveCategory: (v: string) => setParam("c", v, ""),
      activeNeighborhood: params.get("hood") ?? "",
      setActiveNeighborhood: (v: string) => setParam("hood", v, ""),
      activeDate: params.get("d") ?? "All",
      setActiveDate: (v: string) => setParam("d", v, "All"),
      activeEntry,
      setActiveEntry: (v: number) => setParam("e", String(v), "20"),
    }),
    [params, setParam, activeCategory, activeEntry],
  );
}
