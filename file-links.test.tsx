import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, waitFor } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { defaultConfiguration } from "./actions";
import { requestFile } from "./file-request";
import appDefinition from "./app";
const app = await loadPluginApp(() => Promise.resolve({ default: appDefinition }));
const mounted: { lifecycle: { unmount(): void } }[] = [];
afterEach(() => { mounted.splice(0).forEach(slot => slot.lifecycle.unmount()); document.body.innerHTML = ""; sessionStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function setup(path = "/tmp/report.pdf", enabled = true, info: { directory: boolean; hostId: string } | null = { directory: false, hostId: "host-test" }, application = { name: "Document Viewer" as string | null, available: true, hostName: "Modal devbox" }) {
  vi.stubGlobal("IntersectionObserver", class {
    constructor(private callback: (entries: any[]) => void) {}
    observe(target: Element) { this.callback([{ target, isIntersecting: true }]); }
    unobserve() {} disconnect() {}
  });
  const row = document.createElement("div"); row.dataset.timelineRowId = "thread-test:message";
  const anchor = document.createElement("a"); anchor.href = `file://${path}#L12C3`; anchor.textContent = "report";
  row.append(anchor); document.body.append(row);
  const openDefault = vi.fn();
  const slot = renderSlot(app.threadHeaderActions[0], { threadId: "thread-test", projectId: "project-test", isCompactViewport: false }, {
    rpc: { configuration: () => structuredClone(defaultConfiguration), inspect: () => info, defaultApplication: () => application, openDefault },
    settings: { replaceDefaultClick: enabled },
  }); mounted.push(slot);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  return { slot, anchor, openDefault };
}
describe("file-link menu", () => {
  it("shows and runs the configured default and hands off the original menu", async () => {
    const { slot, anchor, openDefault } = await setup();
    const original = vi.fn((event: Event) => event.preventDefault()); anchor.addEventListener("contextmenu", original);
    fireEvent.contextMenu(anchor);
    fireEvent.click(await slot.findByRole("menuitem", { name: "Default: Document Viewer on Modal devbox" }));
    await waitFor(() => expect(openDefault).toHaveBeenCalledTimes(1));
    expect(original).not.toHaveBeenCalled();
    fireEvent.contextMenu(anchor);
    fireEvent.click(await slot.findByRole("menuitem", { name: "More open options…" }));
    expect(original).toHaveBeenCalledTimes(1);
    fireEvent.contextMenu(anchor, { shiftKey: true }); expect(original).toHaveBeenCalledTimes(2);
  });
  it("preserves line targets for preview and opens File settings from the menu", async () => {
    const { slot, anchor } = await setup("/tmp/example.py");
    anchor.focus(); fireEvent.contextMenu(anchor);
    await slot.findByRole("menuitem", { name: "Default: Preview in BB" });
    fireEvent.keyDown(document, { key: "End" });
    expect(document.activeElement?.textContent).toBe("Change default…");
    fireEvent.keyDown(document, { key: "Escape" }); expect(document.activeElement).toBe(anchor);
    fireEvent.contextMenu(anchor);
    fireEvent.click(await slot.findByRole("menuitem", { name: "Open with built-in preview" }));
    expect(slot.inspection.navigateCalls).toContainEqual({ method: "experimental_openFilePreview", options: { target: { kind: "host", hostId: "host-test", path: "/tmp/example.py" }, location: { kind: "line", line: 12, column: 3 } } });
    fireEvent.contextMenu(anchor); fireEvent.click(await slot.findByRole("menuitem", { name: "Change default…" }));
    expect(slot.inspection.navigateCalls.some(call => call.method === "toPluginPanel")).toBe(true);
    const settings = renderSlot(app.settingsSections[0], {}, { rpc: { configuration: () => structuredClone(defaultConfiguration) } }); mounted.push(settings);
    await waitFor(() => expect(document.activeElement).toBe(settings.getByRole("combobox", { name: "File action 1" })));
    expect((settings.getByLabelText("Try a filename") as HTMLInputElement).value).toBe("/tmp/example.py");
  });
  it("explains a missing application on the file host and disables those actions", async () => {
    const { slot, anchor, openDefault } = await setup("/tmp/report.pdf", true, { directory: false, hostId: "host-test" }, { name: null, available: false, hostName: "Modal devbox" });
    fireEvent.contextMenu(anchor);
    const button = await slot.findByRole("menuitem", { name: "Default: No application configured on Modal devbox" });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(slot.getByRole("menuitem", { name: "No application configured on Modal devbox" }).hasAttribute("disabled")).toBe(true);
    expect(slot.getByRole("menuitem", { name: "Open with built-in preview" }).hasAttribute("disabled")).toBe(false);
    fireEvent.click(button); expect(openDefault).not.toHaveBeenCalled();
  });
  it("retains BB handling for unverified targets and disposes listeners", async () => {
    const { slot, anchor } = await setup("/tmp/missing.pdf", true, null);
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true }); anchor.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false); expect(document.querySelector('[aria-label="File link"]')).toBe(null);
    slot.lifecycle.unmount();
    const next = new MouseEvent("contextmenu", { bubbles: true, cancelable: true }); anchor.dispatchEvent(next); expect(next.defaultPrevented).toBe(false);
  });
  it("offers one-off actions when overrides are disabled", async () => {
    const { slot, anchor, openDefault } = await setup("/tmp/report.pdf", false);
    fireEvent.contextMenu(anchor);
    expect(await slot.findByRole("menuitem", { name: "Default: BB file handler" })).toBeTruthy();
    fireEvent.click(slot.getByRole("menuitem", { name: "Open in Document Viewer on Modal devbox" }));
    await waitFor(() => expect(openDefault).toHaveBeenCalledTimes(1));
  });
});
describe("file settings handoff", () => {
  it("adds a new extension rule, preserves unsaved edits and reuses the rule on repeated requests", async () => {
    const slot = renderSlot(app.settingsSections[0], {}, { rpc: { configuration: () => structuredClone(defaultConfiguration) } }); mounted.push(slot);
    fireEvent.change(await slot.findByRole("textbox", { name: "General rule 1" }), { target: { value: "Keep this draft" } });
    act(() => requestFile("/tmp/report.PDF"));
    await waitFor(() => expect(document.activeElement).toBe(slot.getByRole("combobox", { name: "File action 2" })));
    expect((slot.getByRole("textbox", { name: "Extensions 2" }) as HTMLInputElement).value).toBe(".pdf");
    expect(slot.getByRole("tab", { name: "Files" }).getAttribute("aria-selected")).toBe("true");
    act(() => requestFile("/tmp/another.pdf"));
    await waitFor(() => expect((slot.getByLabelText("Try a filename") as HTMLInputElement).value).toBe("/tmp/another.pdf"));
    expect(slot.getAllByRole("textbox", { name: /^Extensions/ })).toHaveLength(2);
    fireEvent.click(slot.getByRole("tab", { name: "Web" }));
    expect((slot.getByRole("textbox", { name: "General rule 1" }) as HTMLTextAreaElement).value).toBe("Keep this draft");
  });
});
