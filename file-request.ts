import { fileBasename } from "./links";
export const fileRequestKey = "link-rules:file";
export const fileRequestEvent = "link-rules:edit-file";
export function readFileRequest(): { id: string; path: string } | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(fileRequestKey) ?? "null");
    return value && typeof value.id === "string" && typeof value.path === "string" && value.path.length > 0 ? value : null;
  } catch { return null; }
}
export function requestFile(path: string) {
  sessionStorage.setItem(fileRequestKey, JSON.stringify({ id: crypto.randomUUID(), path }));
  window.dispatchEvent(new Event(fileRequestEvent));
}
export function fileExtension(path: string) {
  const name = fileBasename(path).toLowerCase();
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot);
}
