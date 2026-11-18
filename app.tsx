import { useCallback, useEffect } from "react";
import { definePluginApp, useBbNavigate, useRpc, useSettings, type PluginThreadHeaderActionProps } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "./server";
import { parseFileLink } from "./links";
import { getMessages } from "./messages";
import { useFileLinks } from "./use-file-links";
import { actionFor } from "./actions";
import { FileLinkSettings } from "./settings";
import { useConfiguration } from "./use-configuration";
import { useLocale } from "./use-locale";

// No hover UI or link decoration: only override a verified file's normal click.
function FileLinkActions({ threadId }: PluginThreadHeaderActionProps) {
  const locale = useLocale();
  const { config } = useConfiguration();
  const rpc = useRpc<typeof rpcContract>();
  const navigate = useBbNavigate();
  const { values } = useSettings();
  const enabled = values?.replaceDefaultClick === true;
  const inspect = useCallback((path: string) => rpc.call("inspect", { path, threadId, locale }), [rpc, threadId, locale]);
  const verified = useFileLinks(threadId, enabled ? inspect : null);

  useEffect(() => {
    if (!enabled || !config) return;
    async function run(target: NonNullable<ReturnType<typeof parseFileLink>>, hostId: string, directory: boolean) {
      const action = actionFor(config!, target.path, directory);
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
    }
    function click(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.closest("[data-timeline-row-id]")?.getAttribute("data-timeline-row-id")?.split(":")[0] !== threadId) return;
      const target = parseFileLink(anchor.getAttribute("href"));
      const confirmed = verified.current.get(anchor);
      if (!target || !confirmed || confirmed.path !== target.path) return;
      event.preventDefault(); event.stopImmediatePropagation();
      void run(target, confirmed.hostId, confirmed.directory);
    }
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, [enabled, config, navigate, rpc, threadId, locale, verified]);
  return null;
}

export default definePluginApp((app) => {
  app.slots.settingsSection({ id: "file-link-settings", component: FileLinkSettings });
  app.slots.experimental_threadHeaderAction({ id: "file-link-actions", title: "Link Rules", component: FileLinkActions });
});
