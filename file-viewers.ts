import { useCallback, useEffect, useState } from "react";
import { useSdk, type PluginAppDefinition, type PluginFileOpenerRegistration, type PluginAppBuilder } from "@get-bb/plugin-sdk/app";

import { viewerAction, type FileViewer } from "./file-destinations";

// PluginAppDefinition.setup is a declarative registration pass. Read only
// fileOpener metadata; never mount another plugin's components in our context.
export function collectFileViewers(pluginId: string, definition: PluginAppDefinition): FileViewer[] {
  const viewers: FileViewer[] = [];
  const noop: (...args: unknown[]) => void = new Proxy(() => undefined, { get: (): unknown => noop });
  const slots = new Proxy({}, { get: (_, key) => key === "fileOpener" ? (registration: PluginFileOpenerRegistration) => {
    if (typeof registration.id !== "string" || typeof registration.title !== "string" || !Array.isArray(registration.extensions)) return;
    viewers.push({ action: viewerAction(pluginId, registration.id), title: registration.title,
      extensions: registration.extensions.filter(ext => typeof ext === "string").map(ext => ext.replace(/^\./u, "").toLowerCase()) });
  } : noop });
  definition.setup(new Proxy({ slots }, { get: (target, key) => key === "slots" ? target.slots : noop }) as PluginAppBuilder);
  return viewers;
}
export function useFileViewers() {
  const sdk = useSdk();
  const [viewers, setViewers] = useState<FileViewer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const { plugins } = await sdk.plugins.list();
    const results = await Promise.allSettled(plugins.filter(p => p.enabled && p.app.bundle?.compatible).map(async plugin => {
      const url = new URL(plugin.app.bundle!.jsUrl, window.location.origin);
      if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/v1/plugin-app-assets/")) return [];
      const module = await import(/* @vite-ignore */ url.href);
      return module.default?.__bbPluginApp ? collectFileViewers(plugin.id, module.default) : [];
    }));
    return { viewers: results.flatMap(result => result.status === "fulfilled" ? result.value : []),
      error: results.some(result => result.status === "rejected") ? "Some installed viewers could not be loaded. Retry to refresh the choices." : null };
  }, [sdk]);
  useEffect(() => {
    let disposed = false;
    function refresh() { void reload().then(result => { if (!disposed) { setViewers(result.viewers); setError(result.error); } }).catch(() => { if (!disposed) setError("Could not load installed viewers."); }); }
    refresh(); window.addEventListener("focus", refresh);
    return () => { disposed = true; window.removeEventListener("focus", refresh); };
  }, [reload]);
  return { viewers, error };
}
