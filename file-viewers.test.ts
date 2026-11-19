import { expect, it } from "vitest";
import { definePluginApp } from "@get-bb/plugin-sdk/app";
import { collectFileViewers } from "./file-viewers";
it("collects file opener metadata without mounting viewers or registering unrelated slots", () => {
  const app = definePluginApp(builder => {
    builder.slots.fileOpener({ id: "pdf", title: "Office Viewer — PDF", extensions: ["PDF"], component: () => { throw new Error("Must never mount"); } });
    builder.slots.navPanel({ id: "studio", title: "Studio", icon: "File", path: "studio", component: () => null });
  });
  expect(collectFileViewers("office-viewer", app)).toEqual([{ action: "viewer:office-viewer:pdf", title: "Office Viewer — PDF", extensions: ["pdf"] }]);
});
