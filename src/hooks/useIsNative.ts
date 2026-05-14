import { Capacitor } from "@capacitor/core";

export function useIsNative(): boolean {
  return Capacitor.isNativePlatform();
}
