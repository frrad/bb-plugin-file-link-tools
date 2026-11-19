import { useCallback, useEffect, useRef, useState } from "react";
import { definePluginApp, experimental_copyToClipboard, useBbNavigate, useRpc, useSettings, type PluginThreadHeaderActionProps } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "./server";
import { fileBasename, parseFileLink, type ParsedFileLink } from "./links";
import { getMessages } from "./messages";
import { useFileLinks } from "./use-file-links";
import { actionFor, fileActionLabels } from "./actions";
import { FileLinkSettings } from "./settings";
import { useConfiguration } from "./use-configuration";
import { useLocale } from "./use-locale";
import { WebLinks } from "./web-links";
import { LinkMenu, type LinkMenuTarget } from "./link-menu";
import { requestFile } from "./file-request";
type FileMenu = LinkMenuTarget & ParsedFileLink & { directory: boolean; hostId: string; href: string };

// Verified file links share click actions and the settings-aware link menu.
function FileLinkActions({ threadId }: PluginThreadHeaderActionProps) {
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
  const [application, setApplication] = useState<{ name: string | null; available: boolean | null; hostName: string } | null>(null);
  useEffect(() => {
    setApplication(null);
    if (!menu || menu.directory) return;
    let disposed = false;
    void rpc.call("defaultApplication", { path: menu.path, threadId, locale }).then(value => {
      if (!disposed) setApplication(value);
    }).catch(() => { if (!disposed) setApplication({ name: null, available: null, hostName: "file host" }); });
    return () => { disposed = true; };
  }, [menu, rpc, threadId, locale]);

  const run = useCallback(async (target: ParsedFileLink, hostId: string, action: string) => {
    try {
      if (action === "preview") {
        if (!navigate.experimental_openFilePreview({ target: { kind: "host", hostId, path: target.path }, location: target.location })) {
          throw new Error(getMessages(locale).openPreviewFailed);
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
  }, [navigate, rpc, threadId, locale]);
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
      void run(target, target.hostId, actionFor(config!, target.path, target.directory));
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
  }, [enabled, config, run, threadId, verified]);
  useEffect(() => { setMenu(null); }, [threadId, enabled]);
  if (!menu || !config) return null;
  const labels = fileActionLabels(config);
  const applicationLabel = !application ? "Checking application on file host…"
    : application.available === false ? `No application configured on ${application.hostName}`
    : application.name ? `${application.name} on ${application.hostName}`
    : `System application on ${application.hostName} (name unavailable)`;
  labels.external = applicationLabel;
  const externalUnavailable = application?.available === false;
  const defaultAction = enabled ? actionFor(config, menu.path, menu.directory) : "bb";
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
    <button role="menuitem" disabled={defaultAction === "external" && externalUnavailable} onClick={() => open(defaultAction)}>Default: {defaultAction === "bb" ? "BB file handler" : labels[defaultAction]}</button>
    <hr role="separator" />
    {!menu.directory && <button role="menuitem" onClick={() => open("preview")}>Open with built-in preview</button>}
    {!menu.directory && <button role="menuitem" disabled={externalUnavailable} onClick={() => open("external")}>{!application || externalUnavailable ? applicationLabel : `Open in ${applicationLabel}`}</button>}
    <button role="menuitem" onClick={() => open("folder")}>Show in folder</button>
    {config.tools.map(tool => <button key={tool.id} role="menuitem" onClick={() => open(tool.id)}>Open with {tool.name}</button>)}
    <button role="menuitem" onClick={() => { setMenu(null); originalMenu(); }}>More open options…</button>
    <hr role="separator" />
    <button role="menuitem" onClick={() => void copy(menu.path)}>Copy file path</button>
    <button role="menuitem" onClick={() => void copy(fileBasename(menu.path))}>Copy file name</button>
    <hr role="separator" />
    <button role="menuitem" onClick={() => { requestFile(menu.path); setMenu(null); navigate.toPluginPanel("settings"); }}>Change default…</button>
  </LinkMenu>;
}

export default definePluginApp((app) => {
  app.slots.experimental_appOverlay({ id: "web-links", component: WebLinks });
  app.slots.navPanel({ id: "link-rules-settings", title: "Link Rules", icon: "ExternalLink", path: "settings", component: () => <div style={{ padding: "16px 20px", overflow: "auto", height: "100%" }}><FileLinkSettings /></div> });
  app.slots.settingsSection({ id: "file-link-settings", component: FileLinkSettings });
  app.slots.experimental_threadHeaderAction({ id: "file-link-actions", title: "Link Rules", component: FileLinkActions });
});
