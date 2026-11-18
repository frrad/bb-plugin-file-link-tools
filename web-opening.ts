import { webUrl } from "./web-rules.ts";

type DesktopBridge = { openExternalUrl(url: string): void | Promise<unknown> };
// BB currently exposes no public SDK method to force the viewing device's main
// browser. Keep this desktop compatibility dependency isolated and feature checked.
export function openMainBrowser(value: string, host: Window = window): void | Promise<unknown> {
  const url = webUrl(value);
  if (!url) throw new Error("Only HTTP(S) web links can open in the main browser");
  const desktop = (host as Window & { bbDesktop?: DesktopBridge }).bbDesktop;
  if (typeof desktop?.openExternalUrl === "function") return desktop.openExternalUrl(url);
  host.open(url, "_blank", "noopener,noreferrer");
}

export function externalAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  if (!anchor || anchor.hasAttribute("download") || anchor.closest("[data-link-rules]")) return null;
  const href = anchor.getAttribute("href") ?? "";
  // App routes and local anchors retain BB navigation, including absolute links
  // back to the current BB server. Embedded browser documents are separate.
  if (!/^https?:\/\//iu.test(href) || !webUrl(href) || new URL(href).origin === window.location.origin) return null;
  return anchor;
}
