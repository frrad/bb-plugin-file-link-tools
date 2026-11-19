import { describe, expect, it } from "vitest";
import { configurationSchema, defaultConfiguration } from "./actions";
import { applyFileExample } from "./file-rules";
import { destinationFor } from "./file-destinations";
import { filePanelTab } from "./file-panels";
describe("file destinations", () => {
  const viewers = [{ action: "viewer:office-viewer:pdf", title: "Office Viewer — PDF", extensions: ["pdf"] }];
  it("uses the same destination for example checks and file clicks", () => {
    const example = { path: "/tmp/report.PDF", action: "viewer:office-viewer:pdf", narrative: "PDFs in the sidebar", directory: false };
    const config = configurationSchema.parse({ ...defaultConfiguration, rules: [{ extensions: [".pdf", ".txt"], action: "preview" }] });
    const next = applyFileExample(config, example);
    expect(next.rules).toEqual([{ extensions: [".pdf"], action: example.action }, { extensions: [".txt"], action: "preview" }]);
    expect(destinationFor(next, example.path, viewers)).toBe(example.action);
    expect(destinationFor(defaultConfiguration, example.path, viewers)).toBe(example.action);
    expect(destinationFor(defaultConfiguration, "/tmp/readme.unknown", viewers)).toBe("preview");
    expect(destinationFor(next, "/tmp/folder.pdf", viewers, true)).toBe("explorer");
    expect(() => applyFileExample(config, { ...example, path: "no-extension" })).toThrow();
  });
  it("persists viewer choices and examples while rejecting malformed actions", () => {
    expect(configurationSchema.parse({ ...defaultConfiguration, defaultAction: "viewer:office-viewer:pdf" }).defaultAction).toBe("viewer:office-viewer:pdf");
    expect(configurationSchema.safeParse({ ...defaultConfiguration, defaultAction: "viewer:../../bad:pdf" }).success).toBe(false);
    const old = { ...defaultConfiguration } as any; delete old.fileExamples;
    expect(configurationSchema.parse(old).fileExamples).toEqual([]);
  });
  it("builds the host-owned viewer tab with source and range information", () => {
    const input = { path: "/tmp/report.pdf", threadId: "t1", hostId: "h1", action: "viewer:office-viewer:pdf", line: 12, endLine: 20 };
    const tab = filePanelTab(input);
    expect(tab.kind).toBe("plugin-panel");
    if (tab.kind !== "plugin-panel") throw new Error("Expected plugin viewer");
    expect(tab).toMatchObject({ pluginId: "office-viewer", actionId: "file-opener:pdf", fileOpenerOwner: { hostId: "h1", tab: { path: input.path, lineRange: { startLineNumber: 12, endLineNumber: 20 } } } });
    expect(JSON.parse(tab.paramsJson!)).toMatchObject({ path: input.path, source: { kind: "host", experimental_hostId: "h1" } });
    expect(filePanelTab({ ...input, action: "preview" })).not.toHaveProperty("tab");
    expect(filePanelTab({ ...input, action: "explorer" })).toMatchObject({ pluginId: "files-editor", actionId: "files" });
  });
});
