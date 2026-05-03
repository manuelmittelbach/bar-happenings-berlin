import { useEffect, useState } from "react";

/**
 * useState for strings, mirrored to sessionStorage. On first mount the value
 * resolves to: urlOverride (when non-null) → sessionStorage[key] → defaultValue.
 * Subsequent updates are written back to sessionStorage so back-button
 * navigations restore the filter state.
 */
export function useSessionState(
  key: string,
  defaultValue: string,
  urlOverride?: string | null,
): [string, React.Dispatch<React.SetStateAction<string>>] {
  const [value, setValue] = useState(() => {
    if (urlOverride !== undefined && urlOverride !== null) return urlOverride;
    try {
      const stored = sessionStorage.getItem(key);
      return stored !== null ? stored : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // quota / disabled — silent
    }
  }, [key, value]);

  return [value, setValue];
}
