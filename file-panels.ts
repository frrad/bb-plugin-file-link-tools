import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { fileBasename } from "./links.ts";

type PanelRequest = { path: string; threadId: string; hostId: string; action: string; line: number | undefined; endLine: number | undefined };
// Match the host's file-opener tab identity and public thread-tab schema. This
// small adapter is the only dependency on BB's file-opener tab representation.
export function filePanelTab({ path, threadId, hostId, action, line, endLine }: PanelRequest) {
  const lineRange = line ? { startLineNumber: line, endLineNumber: endLine ?? line } : null;
  const owner = { kind: "host-file-preview" as const, environmentId: null, hostId, threadId: null, tab: { path, lineRange } };
  if (action === "preview") return { kind: "host-file-preview" as const, environmentId: null, hostId, threadId: null, id: `host-file-preview:${encodeURIComponent(path)}:${encodeURIComponent(`host:${hostId}`)}`, path, lineRange };
  const match = action.match(/^viewer:([a-zA-Z0-9_.-]+):([a-zA-Z0-9_.-]+)$/u);
  const pluginId = action === "explorer" ? "files-editor" : match?.[1];
  const actionId = action === "explorer" ? "files" : match ? `file-opener:${match[2]}` : null;
  if (!pluginId || !actionId) throw new Error("Choose an installed file viewer");
  const paramsJson = action === "explorer" ? null : JSON.stringify({ path, source: { kind: "host", environmentId: null, experimental_hostId: hostId, projectId: null, threadId: null } });
  return { kind: "plugin-panel" as const, pluginId, actionId, paramsJson, title: action === "explorer" ? "Files" : fileBasename(path),
    id: `plugin-panel:${encodeURIComponent(`${pluginId}:${actionId}:${paramsJson ?? ""}`)}:none`,
    ...(action === "explorer" ? {} : { fileOpenerOwner: owner }) };
}
export async function addFilePanel(bb: BbPluginApi, request: PanelRequest) {
  const tab = filePanelTab(request);
  if (tab.kind === "plugin-panel") {
    const { plugins } = await bb.sdk.plugins.list();
    if (!plugins.some(plugin => plugin.id === tab.pluginId && plugin.enabled && plugin.app.bundle?.compatible)) throw new Error("This viewer is unavailable. Choose another viewer in Link Rules.");
  }
  for (let attempt = 0; ; attempt++) {
    const current = await bb.sdk.threads.tabs.get({ threadId: request.threadId });
    try {
      await bb.sdk.threads.tabs.update({ threadId: request.threadId, expectedRevision: current.revision, tabs: [...current.tabs.filter(item => item.id !== tab.id), tab] });
      return { tabId: tab.id };
    } catch (error) {
      if (attempt >= 2 || !(error instanceof Error) || !("status" in error) || error.status !== 409) throw error;
    }
  }
}
