import { flushSync } from "react-dom";

export const browserPreferenceKey = "bb.openLinksInAppBrowser";
export function hasBBBrowser(host: Window = window): boolean {
  return !!(host as Window & { bbDesktop?: { browser?: unknown } }).bbDesktop?.browser;
}
// BB has no public per-open browser override. Enabling its client-local
// preference lets the original anchor open in its own BB panel context. Keep
// this compatibility boundary isolated; external rules use their own opener.
export function enableBBBrowser(host: Window = window) {
  if (!hasBBBrowser(host)) throw new Error("The BB browser is available in the BB desktop app");
  const oldValue = host.localStorage.getItem(browserPreferenceKey);
  if (oldValue === "true" || oldValue === null) return;
  flushSync(() => {
    host.localStorage.setItem(browserPreferenceKey, "true");
    host.dispatchEvent(new StorageEvent("storage", { key: browserPreferenceKey, oldValue, newValue: "true", storageArea: host.localStorage }));
  });
}
