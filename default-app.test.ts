// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { linuxDefaultApplication } from "./default-app";
afterEach(() => vi.unstubAllEnvs());
it("distinguishes no application from an unrecognized query response", async () => {
  expect(await linuxDefaultApplication('No default applications for “application/pdf”\n')).toEqual({ name: null, available: false });
  expect(await linuxDefaultApplication("unrecognized response")).toEqual({ name: null, available: null });
});
it("reads the registered application's display name from its desktop entry", async () => {
  const dir = await mkdtemp(join(tmpdir(), "link-rules-app-"));
  try {
    vi.stubEnv("XDG_DATA_HOME", dir); vi.stubEnv("XDG_DATA_DIRS", dir);
    await mkdir(join(dir, "applications"));
    await writeFile(join(dir, "applications", "org.gnome.Evince.desktop"), "[Desktop Entry]\nName=Document Viewer\nExec=evince %U\n[Desktop Action new-window]\nName=New Window\n");
    expect(await linuxDefaultApplication("Default application for 'application/pdf': org.gnome.Evince.desktop\nRegistered applications:\n"))
      .toEqual({ name: "Document Viewer", available: true });
    expect(await linuxDefaultApplication("Default application for 'application/pdf': ../../bad.desktop\n"))
      .toEqual({ name: null, available: null });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
