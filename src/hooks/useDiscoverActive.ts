import { useSyncExternalStore } from "react";

const EVENT = "discover-active-change";

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
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener(EVENT, listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener(EVENT, listener);
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
