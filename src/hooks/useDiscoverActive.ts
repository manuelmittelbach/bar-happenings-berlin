import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function setDiscoverActive(value: boolean) {
  if (value) {
    sessionStorage.setItem("discover-active", "1");
  } else {
    sessionStorage.removeItem("discover-active");
  }
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return sessionStorage.getItem("discover-active") === "1";
}

function getServerSnapshot() {
  return false;
}

export function useDiscoverActive() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
