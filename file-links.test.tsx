import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, waitFor } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { configurationSchema, defaultConfiguration, type Configuration } from "./actions";
import { requestFile } from "./file-request";
import appDefinition from "./app";
vi.mock("./file-viewers", () => ({ useFileViewers: () => ({ viewers: [
  { action: "viewer:office-viewer:pdf", title: "Office Viewer — PDF", extensions: ["pdf"] },
  { action: "viewer:pdf-preview:pdf", title: "PDF viewer", extensions: ["pdf"] },
], error: null }) }));
const app = await loadPluginApp(() => Promise.resolve({ default: appDefinition }));
const mounted: { lifecycle: { unmount(): void } }[] = [];
afterEach(() => { mounted.splice(0).forEach(slot => slot.lifecycle.unmount()); document.body.innerHTML = ""; sessionStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function setup(path = "/tmp/report.pdf", enabled = true, info: { directory: boolean; hostId: string } | null = { directory: false, hostId: "host-test" }) {
  vi.stubGlobal("IntersectionObserver", class {
    constructor(private callback: (entries: any[]) => void) {}
    observe(target: Element) { this.callback([{ target, isIntersecting: true }]); }
    unobserve() {} disconnect() {}
  });
  const row = document.createElement("div"); row.dataset.timelineRowId = "thread-test:message";
  const anchor = document.createElement("a"); anchor.href = `file://${path}#L12C3`; anchor.textContent = "report";
  row.append(anchor); document.body.append(row);
  const openFilePanel = vi.fn((_input: unknown) => ({ tabId: "viewer-tab" }));
  const selectTab = vi.fn(() => true);
  const slot = renderSlot(app.threadHeaderActions[0], { threadId: "thread-test", projectId: "project-test", isCompactViewport: false }, {
    context: { threadId: "thread-test", projectId: "project-test" },
    rpc: { configuration: () => structuredClone(defaultConfiguration), inspect: () => info, openFilePanel },
    experimental_panel: { selectTab }, settings: { replaceDefaultClick: enabled },
  }); mounted.push(slot);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  return { slot, anchor, openFilePanel, selectTab };
}
describe("file-link menu", () => {
  it("names the chosen sidebar viewer, opens it, and retains the original menu", async () => {
    const { slot, anchor, openFilePanel, selectTab } = await setup();
    const original = vi.fn((event: Event) => event.preventDefault()); anchor.addEventListener("contextmenu", original);
    fireEvent.contextMenu(anchor);
    fireEvent.click(await slot.findByRole("menuitem", { name: "Default: Office Viewer — PDF" }));
    await waitFor(() => expect(openFilePanel).toHaveBeenCalledTimes(1));
    expect(openFilePanel.mock.calls[0][0]).toMatchObject({ action: "viewer:office-viewer:pdf", path: "/tmp/report.pdf" });
    await waitFor(() => expect(selectTab).toHaveBeenCalledWith("viewer-tab"));
    expect(original).not.toHaveBeenCalled();
    fireEvent.contextMenu(anchor);
    fireEvent.click(await slot.findByRole("menuitem", { name: "More open options…" }));
    expect(original).toHaveBeenCalledTimes(1);
    fireEvent.contextMenu(anchor, { shiftKey: true }); expect(original).toHaveBeenCalledTimes(2);
  });
  it("preserves line targets, keyboard behavior, and hands off an example", async () => {
    const { slot, anchor, openFilePanel } = await setup("/tmp/example.py");
    anchor.focus(); fireEvent.contextMenu(anchor);
    await slot.findByRole("menuitem", { name: "Default: Built-in preview" });
    fireEvent.keyDown(document, { key: "End" }); expect(document.activeElement?.textContent).toBe("Change default…");
    fireEvent.keyDown(document, { key: "Escape" }); expect(document.activeElement).toBe(anchor);
    fireEvent.contextMenu(anchor); fireEvent.click(await slot.findByRole("menuitem", { name: "Open with built-in preview" }));
    await waitFor(() => expect(openFilePanel).toHaveBeenCalledTimes(1));
    expect(openFilePanel.mock.calls[0][0]).toMatchObject({ action: "preview", path: "/tmp/example.py", line: 12 });
    fireEvent.contextMenu(anchor); fireEvent.click(await slot.findByRole("menuitem", { name: "Change default…" }));
    expect(slot.inspection.navigateCalls.some(call => call.method === "toPluginPanel")).toBe(true);
    const settings = renderSlot(app.settingsSections[0], {}, { rpc: { configuration: () => structuredClone(defaultConfiguration) } }); mounted.push(settings);
    await waitFor(() => expect(document.activeElement).toBe(settings.getByRole("combobox", { name: "Desired file outcome 1" })));
    expect((settings.getByRole("textbox", { name: "Example file 1" }) as HTMLInputElement).value).toBe("/tmp/example.py");
  });
  it("offers installed viewers and file explorer as one-off sidebar actions", async () => {
    const { slot, anchor, openFilePanel } = await setup();
    fireEvent.contextMenu(anchor);
    expect(await slot.findByRole("menuitem", { name: "Open with Office Viewer — PDF" })).toBeTruthy();
    expect(slot.getByRole("menuitem", { name: "Open with PDF viewer" })).toBeTruthy();
    expect(slot.queryByText(/application configured|default app/i)).toBe(null);
    fireEvent.click(slot.getByRole("menuitem", { name: "Open in file explorer" }));
    await waitFor(() => expect(openFilePanel).toHaveBeenCalledTimes(1));
    expect(openFilePanel.mock.calls[0][0]).toMatchObject({ action: "explorer" });
  });
  it("retains BB handling for unverified targets and disposes listeners", async () => {
    const { slot, anchor } = await setup("/tmp/missing.pdf", true, null);
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true }); anchor.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false); expect(document.querySelector('[aria-label="File link"]')).toBe(null);
    slot.lifecycle.unmount();
    const next = new MouseEvent("contextmenu", { bubbles: true, cancelable: true }); anchor.dispatchEvent(next); expect(next.defaultPrevented).toBe(false);
  });
  it("offers one-off viewers when click overrides are disabled", async () => {
    const { slot, anchor, openFilePanel } = await setup("/tmp/report.pdf", false);
    fireEvent.contextMenu(anchor);
    expect(await slot.findByRole("menuitem", { name: "Default: BB file handler" })).toBeTruthy();
    fireEvent.click(slot.getByRole("menuitem", { name: "Open with Office Viewer — PDF" }));
    await waitFor(() => expect(openFilePanel).toHaveBeenCalledTimes(1));
  });
});
describe("file examples", () => {
  it("preserves edits, avoids duplicates, checks desired outcomes, applies an extension rule and saves", async () => {
    let stored: Configuration = structuredClone(defaultConfiguration);
    const save = vi.fn((value: unknown) => { stored = configurationSchema.parse(value); return structuredClone(stored); });
    const slot = renderSlot(app.settingsSections[0], {}, { rpc: { configuration: () => structuredClone(stored), saveConfiguration: save } }); mounted.push(slot);
    fireEvent.change(await slot.findByRole("textbox", { name: "General rule 1" }), { target: { value: "Keep this draft" } });
    act(() => requestFile("/tmp/report.PDF", "viewer:pdf-preview:pdf"));
    await waitFor(() => expect(document.activeElement).toBe(slot.getByRole("combobox", { name: "Desired file outcome 1" })));
    expect(slot.getByRole("tab", { name: "Files" }).getAttribute("aria-selected")).toBe("true");
    expect(slot.getByText("✕ Doesn’t match")).toBeTruthy();
    fireEvent.change(slot.getByRole("combobox", { name: "Desired file outcome 1" }), { target: { value: "viewer:office-viewer:pdf" } });
    fireEvent.change(slot.getByRole("textbox", { name: "File intent 1" }), { target: { value: "PDFs in the sidebar" } });
    act(() => requestFile("/tmp/report.PDF", "preview"));
    await waitFor(() => expect((slot.getByRole("combobox", { name: "Desired file outcome 1" }) as HTMLSelectElement).value).toBe("viewer:office-viewer:pdf"));
    expect(slot.getAllByRole("textbox", { name: /^Example file/ })).toHaveLength(1);
    fireEvent.click(slot.getByRole("button", { name: "Use extension rule" }));
    expect((slot.getByRole("textbox", { name: "Extensions 1" }) as HTMLInputElement).value).toBe(".pdf");
    expect((slot.getByRole("combobox", { name: "File action 1" }) as HTMLSelectElement).value).toBe("viewer:office-viewer:pdf");
    fireEvent.click(slot.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(stored.fileExamples[0]).toMatchObject({ path: "/tmp/report.PDF", action: "viewer:office-viewer:pdf", narrative: "PDFs in the sidebar" });
    expect(stored.examples[0].narrative).toBe("Keep this draft");
  });
});
