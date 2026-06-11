import { useEffect } from "react";
import { useIsFetching } from "@tanstack/react-query";

// Browsers only spin the tab's native throbber during a real page navigation.
// This app is a SPA — after first paint, data arrives via background fetches
// with no navigation, so the tab stays static. This mirrors the throbber by
// swapping the favicon for an animated one whenever React Query has any
// in-flight query (Instagram-style "the tab tells you it's working").

const SIZE = 64; // favicon canvas resolution
const FRAME_COUNT = 12; // pre-rendered rotation frames
const FRAME_MS = 80; // ~12.5fps — smooth enough, cheap to cycle
const START_DELAY_MS = 200; // ignore instant cache hits so the tab doesn't flicker
const LINK_ID = "favicon-spinner";

function roundRect(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.roundRect(0, 0, SIZE, SIZE, r);
}

// Draw one spinner frame (white rounded tile + a rotating orange arc) and
// return it as a PNG data URL. Pre-rendered once into `frames`, then cycled.
function renderFrame(angle: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // White rounded tile — matches the static favicon background.
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, 12);
  ctx.fill();

  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const radius = 18;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";

  // Faint full track ring.
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Brand-orange moving arc (~110° sweep).
  ctx.strokeStyle = "#ED5B1C";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, angle, angle + Math.PI * 0.6);
  ctx.stroke();

  return canvas.toDataURL("image/png");
}

let frames: string[] | null = null;
function getFrames(): string[] {
  if (frames) return frames;
  frames = Array.from({ length: FRAME_COUNT }, (_, i) =>
    renderFrame((i / FRAME_COUNT) * Math.PI * 2),
  );
  return frames;
}

export function FaviconSpinner() {
  const fetching = useIsFetching();

  useEffect(() => {
    if (fetching === 0) return;

    let frameIndex = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    let link: HTMLLinkElement | undefined;

    // Append our own icon link last (browsers honour the last-declared icon),
    // so we never mutate the static <link>s — removing ours restores them.
    const start = () => {
      const rendered = getFrames();
      if (!rendered[0]) return; // canvas unsupported — bail, leave static icon
      link = document.createElement("link");
      link.rel = "icon";
      link.id = LINK_ID;
      link.type = "image/png";
      link.href = rendered[0];
      document.head.appendChild(link);
      interval = setInterval(() => {
        frameIndex = (frameIndex + 1) % FRAME_COUNT;
        if (link) link.href = rendered[frameIndex];
      }, FRAME_MS);
    };

    // Debounce: only spin if the fetch outlives a cache hit / instant resolve.
    const startTimer = setTimeout(start, START_DELAY_MS);

    return () => {
      clearTimeout(startTimer);
      if (interval) clearInterval(interval);
      link?.remove();
    };
  }, [fetching]);

  return null;
}
