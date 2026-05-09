import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";

const HOUR_MS = 60 * 60 * 1000;

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const id = setInterval(() => registration.update(), HOUR_MS);
      return () => clearInterval(id);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toast("New version available", {
      description: "Reload to get the latest improvements.",
      duration: Infinity,
      action: {
        label: "Reload",
        onClick: () => updateServiceWorker(true),
      },
    });
  }, [needRefresh, updateServiceWorker]);

  // Bridge SW debug logs into the page console while we diagnose runtime
  // cache behavior. Remove once caching is verified working.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "sw-log") {
        // eslint-disable-next-line no-console
        console.log(event.data.msg);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  return null;
}
