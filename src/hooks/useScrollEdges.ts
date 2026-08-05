import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tracks whether a horizontal scroller sits at its start/end edge.
 * Drives edge-fade affordances: show a fade only while content is
 * actually hidden in that direction, so a fully visible row shows
 * no fade at all. When the element can't scroll (or is display:none),
 * both flags are true and no fade renders.
 */
export function useScrollEdges<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // 1px tolerance — scrollLeft can land on fractional values.
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    // Re-measure when the scroller or its content resizes (window
    // resize, tab count change, display:none → visible).
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  return { ref, atStart, atEnd };
}
