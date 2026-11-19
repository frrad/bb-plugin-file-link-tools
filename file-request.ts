import { fileBasename } from "./links.ts";
export const fileRequestKey = "link-rules:file";
export const fileRequestEvent = "link-rules:edit-file";
export function readFileRequest(): { id: string; path: string; action?: string; directory?: boolean } | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(fileRequestKey) ?? "null");
    return value && typeof value.id === "string" && typeof value.path === "string" && value.path.length > 0
      && (value.action === undefined || typeof value.action === "string")
      && (value.directory === undefined || typeof value.directory === "boolean") ? value : null;
  } catch { return null; }
}
export function requestFile(path: string, action?: string, directory = false) {
  sessionStorage.setItem(fileRequestKey, JSON.stringify({ id: crypto.randomUUID(), path, action, directory }));
  window.dispatchEvent(new Event(fileRequestEvent));
}
export function fileExtension(path: string) {
  const name = fileBasename(path).toLowerCase();
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot);
}
