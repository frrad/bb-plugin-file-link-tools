import { z } from "zod";

export async function openDefaultFile(path: string, daemonPort: number) {
  z.number().int().min(1).max(65535).parse(daemonPort);
  // shortcut: the SDK cannot select Default App; revalidate this BB daemon route on upgrades.
  const response = await fetch(`http://127.0.0.1:${daemonPort}/open-in-target`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ context: { kind: "local" }, path, targetId: "default-app", lineNumber: null, columnNumber: null }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const message = (await response.text()).trim();
    throw new Error(message || `BB Default App: HTTP ${response.status}`);
  }
}

// Resolve on the same host as openDefaultFile, never on the viewing device.
export type DefaultApplication = { name: string | null; available: boolean | null };
export async function defaultApplication(path: string): Promise<DefaultApplication> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);
  const options = { timeout: 3000, maxBuffer: 64 * 1024, env: { ...process.env, LC_ALL: "C" } };
  try {
    if (process.platform === "darwin") {
      const script = 'ObjC.import("AppKit"); function run(argv) { var app = $.NSWorkspace.sharedWorkspace.URLForApplicationToOpenURL($.NSURL.fileURLWithPath(argv[0])); return app.isNil() ? "" : ObjC.unwrap(app.lastPathComponent.stringByDeletingPathExtension); }';
      const { stdout } = await run("/usr/bin/osascript", ["-l", "JavaScript", "-e", script, path], options);
      return { name: stdout.trim() || null, available: !!stdout.trim() };
    }
    if (process.platform === "linux") {
      const { stdout: mime } = await run("file", ["--brief", "--mime-type", "--", path], options);
      const { stdout } = await run("gio", ["mime", mime.trim()], options);
      return await linuxDefaultApplication(stdout);
    }
  } catch { /* Missing desktop tools and failed queries must not prevent the menu opening. */ }
  return { name: null, available: null };
}

export async function linuxDefaultApplication(output: string): Promise<DefaultApplication> {
  if (/^No default applications /mu.test(output)) return { name: null, available: false };
  const id = output.match(/^Default application for .+: (.+\.desktop)\s*$/mu)?.[1].trim();
  if (!id || !/^[a-zA-Z0-9_.-]+\.desktop$/u.test(id)) return { name: null, available: null };
  const { readFile } = await import("node:fs/promises");
  const { homedir } = await import("node:os");
  const { join } = await import("node:path");
  const roots = [process.env.XDG_DATA_HOME || join(homedir(), ".local/share"), ...(process.env.XDG_DATA_DIRS || "/usr/local/share:/usr/share").split(":")];
  for (const root of roots) {
    try {
      const contents = await readFile(join(root, "applications", id), "utf8");
      const entry = contents.split(/^\[Desktop Entry\]\s*$/mu)[1]?.split(/^\[/mu)[0];
      const name = entry?.match(/^Name=(.+)$/mu)?.[1].trim();
      if (name) return { name, available: true };
    } catch { /* Try the next desktop-entry directory. */ }
  }
  return { name: id.replace(/\.desktop$/u, ""), available: true };
}
