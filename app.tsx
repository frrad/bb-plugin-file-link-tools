import { useCallback, useEffect, useRef, useState } from "react";
import { definePluginApp, experimental_copyToClipboard, experimental_useAppPanel, useBbNavigate, useRpc, useSettings } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "./server";
import { fileBasename, parseFileLink, type ParsedFileLink } from "./links";
import { useFileLinks } from "./use-file-links";
import { actionFor } from "./actions";
import { FileLinkSettings } from "./settings";
import { useConfiguration } from "./use-configuration";
import { useLocale } from "./use-locale";
import { WebLinks } from "./web-links";
import { LinkMenu, type LinkMenuTarget } from "./link-menu";
import { requestFile } from "./file-request";
import { useFileViewers } from "./file-viewers";
import { destinationFor, destinationLabels, destinationLabel } from "./file-destinations";
type FileMenu = LinkMenuTarget & ParsedFileLink & { directory: boolean; hostId: string; href: string };

// Verified file links share click actions and the settings-aware link menu.
function FileLinkActions({ threadId }: { threadId: string }) {
  const locale = useLocale();
  const { config } = useConfiguration();
  const rpc = useRpc<typeof rpcContract>();
  const navigate = useBbNavigate();
  const { values } = useSettings();
  const enabled = values?.replaceDefaultClick === true;
  const inspect = useCallback((path: string) => rpc.call("inspect", { path, threadId, locale }), [rpc, threadId, locale]);
  const verified = useFileLinks(threadId, inspect);
  const [menu, setMenu] = useState<FileMenu | null>(null);
  const bypass = useRef(false);
  const { viewers } = useFileViewers();
  const panel = experimental_useAppPanel();
  const run = useCallback(async (target: ParsedFileLink, hostId: string, action: string) => {
    try {
      if (action === "preview" || action === "explorer" || action.startsWith("viewer:")) {
        const location = target.location;
        const { tabId } = await rpc.call("openFilePanel", { path: target.path, threadId, locale, action,
          ...(location ? { line: location.kind === "range" ? location.startLine : location.line,
            ...(location.kind === "range" ? { endLine: location.endLine } : {}) } : {}) });
        // The public thread-tabs API synchronizes via realtime before the local
        // panel controller can select the tab. Preserve the user's other tabs.
        const deadline = Date.now() + 3000;
        while (!panel.selectTab(tabId)) {
          if (Date.now() > deadline) throw new Error("The viewer did not become available. Try opening the file again.");
          await new Promise(resolve => setTimeout(resolve, 25));
        }
      } else if (action === "external" || action === "folder") {
        await rpc.call(action === "external" ? "openDefault" : "openFolder", { path: target.path, threadId, locale });
      } else {
        const location = target.location;
        await rpc.call("runTool", { path: target.path, threadId, locale, toolId: action,
          ...(location ? { line: location.kind === "range" ? location.startLine : location.line,
            column: location.kind === "line" ? location.column ?? 1 : 1 } : {}),
        });
      }
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : String(cause)); }
  }, [panel, rpc, threadId, locale]);
  useEffect(() => {
    if (!config) return;
    function targetFor(event: MouseEvent) {
      if (!(event.target instanceof Element)) return null;
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.closest("[data-timeline-row-id]")?.getAttribute("data-timeline-row-id")?.split(":")[0] !== threadId) return null;
      const target = parseFileLink(anchor.getAttribute("href"));
      const confirmed = verified.current.get(anchor);
      return target && confirmed && confirmed.path === target.path ? { anchor, ...target, hostId: confirmed.hostId, directory: confirmed.directory } : null;
    }
    function click(event: MouseEvent) {
      if (!enabled || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = targetFor(event);
      if (!target) return;
      event.preventDefault(); event.stopImmediatePropagation();
      void run(target, target.hostId, destinationFor(config!, target.path, viewers, target.directory));
    }
    function context(event: MouseEvent) {
      if (bypass.current || event.defaultPrevented || event.shiftKey) return;
      const target = targetFor(event);
      if (!target) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const rect = target.anchor.getBoundingClientRect();
      setMenu({ ...target, href: target.anchor.href, x: event.clientX || rect.left, y: event.clientY || rect.bottom });
    }
    document.addEventListener("click", click, true);
    document.addEventListener("contextmenu", context, true);
    return () => { document.removeEventListener("click", click, true); document.removeEventListener("contextmenu", context, true); };
  }, [enabled, config, run, threadId, verified, viewers]);
  useEffect(() => { setMenu(null); }, [threadId, enabled]);
  if (!menu || !config) return null;
  const labels = destinationLabels(config, viewers);
  const defaultAction = enabled ? destinationFor(config, menu.path, viewers, menu.directory) : "bb";
  const matchingViewers = viewers.filter(viewer => viewer.extensions.some(extension => menu.path.toLowerCase().endsWith(`.${extension}`)));
  function originalMenu() {
    if (!menu || !menu.anchor.isConnected || menu.anchor.href !== menu.href) return;
    bypass.current = true;
    try { menu.anchor.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: menu.x, clientY: menu.y })); }
    finally { bypass.current = false; }
  }
  function open(action: string) {
    setMenu(null);
    if (action === "bb") {
      if (menu!.anchor.isConnected && menu!.anchor.href === menu!.href) menu!.anchor.click();
    } else void run(menu!, menu!.hostId, action);
  }
  async function copy(value: string) {
    setMenu(null);
    if (!await experimental_copyToClipboard({ text: value })) toast.error("Could not copy to clipboard");
  }
  return <LinkMenu target={menu} label="File link" dismiss={() => setMenu(null)}>
    <button role="menuitem" onClick={() => open(defaultAction)}>Default: {defaultAction === "bb" ? "BB file handler" : destinationLabel(defaultAction, labels)}</button>
    <hr role="separator" />
    {!menu.directory && <button role="menuitem" onClick={() => open("preview")}>Open with built-in preview</button>}
    {!menu.directory && matchingViewers.map(viewer => <button key={viewer.action} role="menuitem" onClick={() => open(viewer.action)}>Open with {viewer.title}</button>)}
    <button role="menuitem" onClick={() => open("explorer")}>Open in file explorer</button>
    {config.tools.map(tool => <button key={tool.id} role="menuitem" onClick={() => open(tool.id)}>Open with {tool.name}</button>)}
    <button role="menuitem" onClick={() => { setMenu(null); originalMenu(); }}>More open options…</button>
    <hr role="separator" />
    <button role="menuitem" onClick={() => void copy(menu.path)}>Copy file path</button>
    <button role="menuitem" onClick={() => void copy(fileBasename(menu.path))}>Copy file name</button>
    <hr role="separator" />
    <button role="menuitem" onClick={() => { requestFile(menu.path, enabled ? actionFor(config, menu.path, menu.directory) : "bb", menu.directory); setMenu(null); navigate.toPluginPanel("settings"); }}>Change default…</button>
  </LinkMenu>;
}

export default definePluginApp((app) => {
  app.slots.experimental_appOverlay({ id: "web-links", component: WebLinks });
  app.slots.navPanel({ id: "link-rules-settings", title: "Link Rules", icon: "ExternalLink", path: "settings", component: () => <div style={{ padding: "16px 20px", overflow: "auto", height: "100%" }}><FileLinkSettings /></div> });
  app.slots.settingsSection({ id: "file-link-settings", component: FileLinkSettings });
  // The compatibility-supported thread header slot supplies the thread's own
  // panel controller. App overlays intentionally have no thread panel scope.
  const slots = app.slots as typeof app.slots & { experimental_threadHeaderAction(registration: { id: string; title: string; component: typeof FileLinkActions }): void };
  slots.experimental_threadHeaderAction({ id: "file-link-actions", title: "Link Rules", component: FileLinkActions });
});
