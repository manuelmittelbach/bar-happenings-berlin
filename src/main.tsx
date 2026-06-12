import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import App from "./App.tsx";
import "./index.css";

// DEBUG: shift "now" by N ms across the whole app — useful for testing
// time-dependent UI (event end times, still-running carry-overs, day
// rollovers). Set back to 0 before shipping.
const DEBUG_TIME_OFFSET_MS: number = 0;
if (DEBUG_TIME_OFFSET_MS !== 0) {
  const RealDate = Date;
  const realNow = RealDate.now.bind(RealDate);
  const offsetNow = () => realNow() + DEBUG_TIME_OFFSET_MS;
  class FakeDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(offsetNow());
      else super(...(args as [string | number | Date]));
    }
    static now() { return offsetNow(); }
  }
  (globalThis as { Date: typeof Date }).Date = FakeDate as typeof Date;
  // eslint-disable-next-line no-console
  console.warn(`[DEBUG] Time offset active: +${DEBUG_TIME_OFFSET_MS / 60000} min`);
}

if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add("is-native");
  StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  if (Capacitor.getPlatform() === "android") {
    StatusBar.setBackgroundColor({ color: "#f8f5ef" }).catch(() => {});
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
  }
  // Tear down any service worker left over from a previous web visit —
  // SW intercepts cross-origin tile requests in the Android WebView and
  // breaks MapLibre. UpdatePrompt is already gated off on native, but
  // an old SW from a prior session can linger until explicitly unregistered.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});
  }
}

// In the browser dev server, tear down any service worker (and its caches)
// left over from a production visit. The PWA registers with autoUpdate, so a
// lingering SW serves stale assets even after a hard refresh — which hides
// freshly-edited code while developing. Native already unregisters above.
if (import.meta.env.DEV && !Capacitor.isNativePlatform() && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => {});
  if ("caches" in window) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
  }
}

createRoot(document.getElementById("root")!).render(<App />);
