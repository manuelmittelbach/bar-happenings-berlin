import { useEffect, useState } from "react";

/**
 * Returns false until `delayMs` has elapsed since mount, then true.
 * Used to suppress skeleton screens for very fast loads (e.g. cache hits)
 * so the skeleton doesn't flash for a frame or two before content arrives.
 */
export function useDelayedShow(delayMs: number): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setShow(true), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs]);

  return show;
}
