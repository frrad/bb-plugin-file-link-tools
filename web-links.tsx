import { useEffect, useRef, useState } from "react";
import { LinkMenu } from "./link-menu";
import { experimental_copyToClipboard, useBbNavigate, useSettings } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import { useConfiguration } from "./use-configuration";
import { webActionFor, webActionLabels, type WebAction } from "./web-rules";
import { externalAnchor, openMainBrowser } from "./web-opening";
import { browserPreferenceKey, enableBBBrowser, hasBBBrowser } from "./browser-preference";
import { requestExample } from "./example-request";
import "./settings.css";

type Menu = { anchor: HTMLAnchorElement; url: string; x: number; y: number; selection: string };
export function WebLinks() {
  const { config } = useConfiguration();
  const { values } = useSettings();
  const enabled = values?.replaceDefaultClick === true;
  const navigate = useBbNavigate();
  const [menu, setMenu] = useState<Menu | null>(null);
  const bypass = useRef(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const configuredAction = config && menu ? (enabled ? webActionFor(config, menu.url)?.action : "bb") ?? "bb" : "bb";
  const browserAvailable = hasBBBrowser();
  const defaultAction = (!enabled && localStorage.getItem(browserPreferenceKey) === "false") || (configuredAction === "bb" && !browserAvailable) ? "external" : configuredAction;

  function dismiss(restore = false) {
    setMenu(null);
    if (restore) previousFocus.current?.focus({ preventScroll: true });
  }
  function open(action: WebAction) {
    if (!menu) return;
    const target = menu;
    dismiss();
    if (action === "external") {
      try { void Promise.resolve(openMainBrowser(target.url)).catch(error => toast.error(String(error))); }
      catch (error) { toast.error(String(error)); }
    } else {
      try { enableBBBrowser(); } catch (error) { toast.error(String(error)); return; }
      // Replay with BB’s preference enabled, in the original panel context.
      bypass.current = true;
      try { if (target.anchor.isConnected && target.anchor.href === target.url) target.anchor.click(); else navigate.openUrl(target.url); }
      finally { bypass.current = false; }
    }
  }
  async function copy(value: string) {
    dismiss(true);
    if (!await experimental_copyToClipboard({ text: value })) toast.error("Could not copy to clipboard");
  }
  useEffect(() => {
    if (!config) return;
    function click(event: MouseEvent) {
      if (bypass.current || !enabled || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const anchor = externalAnchor(event.target);
      if (!anchor) return;
      if (webActionFor(config!, anchor.href)?.action !== "external") {
        if (hasBBBrowser()) {
          try { enableBBBrowser(); } catch (error) {
            event.preventDefault(); toast.error(String(error));
          }
        }
        return;
      }
      event.preventDefault(); event.stopImmediatePropagation();
      try { void Promise.resolve(openMainBrowser(anchor.href)).catch(error => toast.error(String(error))); }
      catch (error) { toast.error(String(error)); }
    }
    function context(event: MouseEvent) {
      if (event.defaultPrevented || event.shiftKey) return;
      const anchor = externalAnchor(event.target);
      if (!anchor) return;
      event.preventDefault(); event.stopImmediatePropagation();
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const rect = anchor.getBoundingClientRect();
      setMenu({ anchor, url: anchor.href, x: event.clientX || rect.left, y: event.clientY || rect.bottom, selection: window.getSelection()?.toString() ?? "" });
    }
    document.addEventListener("click", click, true);
    document.addEventListener("contextmenu", context, true);
    return () => { document.removeEventListener("click", click, true); document.removeEventListener("contextmenu", context, true); };
  }, [config, enabled]);

  useEffect(() => { if (!enabled) setMenu(null); }, [enabled]);
  if (!menu) return null;
  return <LinkMenu target={menu} label="Web link" dismiss={() => dismiss()}>
    <button role="menuitem" onClick={() => open(defaultAction)}>Default: {webActionLabels[defaultAction]}</button>
    <hr role="separator" />
    <button role="menuitem" disabled={!browserAvailable} title={browserAvailable ? undefined : "Available in the BB desktop app"} onClick={() => open("bb")}>Open in BB browser</button>
    <button role="menuitem" onClick={() => open("external")}>Open in main browser</button>
    <hr role="separator" />
    <button role="menuitem" onClick={() => void copy(menu.url)}>Copy link</button>
    <button role="menuitem" disabled={!menu.selection} onClick={() => void copy(menu.selection)}>Copy <kbd>⌘C</kbd></button>
    <button role="menuitem" onClick={() => {
      const content = menu.anchor.closest("main") ?? document.querySelector("main") ?? document.body;
      dismiss(); const range = document.createRange(); range.selectNodeContents(content);
      const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
    }}>Select all <kbd>⌘A</kbd></button>
    <hr role="separator" />
    <button role="menuitem" onClick={() => {
      requestExample(menu.url, defaultAction); dismiss(); navigate.toPluginPanel("settings");
    }}>Change default…</button>
  </LinkMenu>;
}
