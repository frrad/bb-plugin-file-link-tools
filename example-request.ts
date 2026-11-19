import { webUrl, type WebAction } from "./web-rules.ts";
export const exampleRequestKey = "link-rules:example";
export const exampleRequestEvent = "link-rules:add-example";
export type ExampleRequest = { id: string; url: string; action?: WebAction };
export function readExampleRequest(): ExampleRequest | null {
  const stored = sessionStorage.getItem(exampleRequestKey);
  if (!stored) return null;
  // Accept the plain URL handed off by older plugin versions too.
  if (webUrl(stored)) return { id: stored, url: stored };
  try {
    const request = JSON.parse(stored);
    return request && typeof request.id === "string" && typeof request.url === "string" && webUrl(request.url)
      && (request.action === undefined || request.action === "bb" || request.action === "external") ? request : null;
  } catch { return null; }
}
export function requestExample(url: string, action: WebAction) {
  sessionStorage.setItem(exampleRequestKey, JSON.stringify({ id: crypto.randomUUID(), url, action }));
  window.dispatchEvent(new Event(exampleRequestEvent));
}
