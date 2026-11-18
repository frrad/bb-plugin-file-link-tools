import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { experimental_copyToClipboard, useBbNavigate, useSettings } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import { useConfiguration } from "./use-configuration";
import { webActionFor, webActionLabels, type WebAction } from "./web-rules";
import { externalAnchor, openMainBrowser } from "./web-opening";
import "./settings.css";

type Menu = { anchor: HTMLAnchorElement; url: string; x: number; y: number; selection: string };
export function WebLinks() {
  const { config } = useConfiguration();
  const { values } = useSettings();
  const enabled = values?.replaceDefaultClick === true;
  const navigate = useBbNavigate();
  const [menu, setMenu] = useState<Menu | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const bypass = useRef(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const defaultAction = config && menu ? (enabled ? webActionFor(config, menu.url)?.action : "bb") ?? "bb" : "bb";

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
      // Replay the anchor's own handler to use its BB panel context without
      // changing the client's global browser preference.
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
      if (!anchor || webActionFor(config!, anchor.href)?.action !== "external") return;
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

  useEffect(() => {
    if (!menu) return;
    const menuRoot = root.current;
    if (menuRoot) {
      const rect = menuRoot.getBoundingClientRect();
      menuRoot.style.left = `${Math.max(8, Math.min(menu.x, window.innerWidth - rect.width - 8))}px`;
      menuRoot.style.top = `${Math.max(8, Math.min(menu.y, window.innerHeight - rect.height - 8))}px`;
      menuRoot.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    }
    function outside(event: PointerEvent) { if (!root.current?.contains(event.target as Node)) setMenu(null); }
    function close(event: Event) {
      if (event.target instanceof Node && root.current?.contains(event.target)) return;
      setMenu(null);
    }
    function key(event: KeyboardEvent) {
      if (event.key === "Escape" || event.key === "Tab") {
        event.preventDefault(); event.stopPropagation(); dismiss(true); return;
      }
      const buttons = Array.from(root.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    }
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", key, true);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", key, true);
      window.removeEventListener("resize", close); window.removeEventListener("scroll", close, true);
    };
  }, [menu]);
  useEffect(() => { if (!enabled) setMenu(null); }, [enabled]);
  if (!menu) return null;
  return createPortal(<div ref={root} data-link-rules role="menu" aria-label="Web link" className="lr-menu" style={{ left: menu.x, top: menu.y }}>
    <button role="menuitem" onClick={() => open(defaultAction)}>Default: {webActionLabels[defaultAction]}</button>
    <hr role="separator" />
    <button role="menuitem" onClick={() => open("bb")}>Open with BB default</button>
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
      sessionStorage.setItem("link-rules:example", menu.url); dismiss(); navigate.toPluginPanel("settings");
    }}>Change default…</button>
  </div>, document.body);
}
