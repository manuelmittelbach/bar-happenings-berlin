import { useRegisterSW } from "virtual:pwa-register/react";

const HOUR_MS = 60 * 60 * 1000;

// Silent registrar for autoUpdate mode: the SW activates and reloads on its
// own when a new version is detected. We just keep an hourly poll so users
// who leave a tab open pick up updates without a manual refresh.
export function UpdatePrompt() {
  useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const id = setInterval(() => registration.update(), HOUR_MS);
      return () => clearInterval(id);
    },
  });

  return null;
}
