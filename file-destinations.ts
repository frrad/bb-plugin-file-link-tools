import { actionFor, fileActionLabels, type Configuration } from "./actions.ts";
import { fileExtension } from "./file-request.ts";
export type FileViewer = { action: string; title: string; extensions: string[] };
export const viewerAction = (pluginId: string, openerId: string) => `viewer:${pluginId}:${openerId}`;
export function destinationFor(config: Configuration, path: string, viewers: FileViewer[], directory = false) {
  const action = actionFor(config, path, directory);
  return action === "bb" ? viewers.find(viewer => viewer.extensions.includes(fileExtension(path).slice(1)))?.action ?? "preview" : action;
}
export function destinationLabels(config: Pick<Configuration, "tools">, viewers: FileViewer[]) {
  return { ...fileActionLabels(config), ...Object.fromEntries(viewers.map(viewer => [viewer.action, viewer.title])) };
}
export function destinationLabel(action: string, labels: Record<string, string>) {
  return labels[action] ?? (action.startsWith("viewer:") ? `Unavailable viewer (${action.slice(7)})` : "Unavailable action");
}
