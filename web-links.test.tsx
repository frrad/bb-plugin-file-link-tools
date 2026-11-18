import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, waitFor } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { configurationSchema, defaultConfiguration } from "./actions";
import type { Configuration } from "./actions";
import appDefinition from "./app";
const app = await loadPluginApp(() => Promise.resolve({ default: appDefinition }));
const mounted: { lifecycle: { unmount(): void } }[] = [];
afterEach(() => { mounted.splice(0).forEach(slot => slot.lifecycle.unmount()); document.body.innerHTML = ""; sessionStorage.clear(); delete (window as any).bbDesktop; vi.restoreAllMocks(); });
async function overlay() {
  const slot = renderSlot(app.appOverlays[0], {}, { rpc: { configuration: () => structuredClone(defaultConfiguration) }, settings: { replaceDefaultClick: true } });
  mounted.push(slot);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  return slot;
}
function link(url: string) {
  const anchor = document.createElement("a"); anchor.href = url; anchor.textContent = "A link"; document.body.append(anchor); return anchor;
}
describe("web-link interaction", () => {
  it("routes Slack clicks, preserves modifiers and app links, and cleans up", async () => {
    const external = vi.fn(); (window as any).bbDesktop = { openExternalUrl: external };
    const slot = await overlay();
    const anchor = link("https://modal.enterprise.slack.com/archives/C123");
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    anchor.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true); expect(external).toHaveBeenCalledTimes(1);
    for (const options of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }]) {
      anchor.addEventListener("click", event => event.preventDefault(), { once: true });
      fireEvent.click(anchor, options);
    }
    expect(external).toHaveBeenCalledTimes(1);
    const local = link(`${window.location.origin}/settings`);
    local.addEventListener("click", event => event.preventDefault()); fireEvent.click(local);
    expect(external).toHaveBeenCalledTimes(1);
    slot.lifecycle.unmount();
    anchor.addEventListener("click", event => event.preventDefault(), { once: true }); fireEvent.click(anchor);
    expect(external).toHaveBeenCalledTimes(1);
  });
  it("shows the default and one-off options, supports escape and settings navigation", async () => {
    const slot = await overlay();
    const anchor = link("https://modal.enterprise.slack.com/archives/C123"); anchor.focus();
    fireEvent.contextMenu(anchor, { clientX: 20, clientY: 20 });
    expect(await slot.findByRole("menuitem", { name: "Default: Main browser" })).toBeTruthy();
    expect(slot.getByRole("menuitem", { name: "Open with BB default" })).toBeTruthy();
    const items = Array.from(document.querySelectorAll('[role="menuitem"]')).map(x => x.textContent);
    expect(items).toEqual(["Default: Main browser", "Open with BB default", "Open in main browser", "Copy link", "Copy ⌘C", "Select all ⌘A", "Change default…"]);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.querySelector('[role="menu"]')).toBe(null); expect(document.activeElement).toBe(anchor);
    fireEvent.contextMenu(anchor);
    fireEvent.click(await slot.findByRole("menuitem", { name: "Change default…" }));
    expect(sessionStorage.getItem("link-rules:example")).toBe(anchor.href);
    expect(slot.inspection.navigateCalls.some(call => call.method === "toPluginPanel")).toBe(true);
  });
  it("replays BB's original click for the one-off BB option", async () => {
    const slot = await overlay(); const external = vi.fn(); (window as any).bbDesktop = { openExternalUrl: external };
    const anchor = link("https://modal.enterprise.slack.com/archives/C123");
    const original = vi.fn((event: Event) => event.preventDefault()); anchor.addEventListener("click", original);
    fireEvent.contextMenu(anchor);
    fireEvent.click(await slot.findByRole("menuitem", { name: "Open with BB default" }));
    expect(original).toHaveBeenCalledTimes(1); expect(external).not.toHaveBeenCalled();
  });
});
describe("settings", () => {
  it("edits expected outcomes and narratives, applies the domain rule and saves", async () => {
    let stored: Configuration = structuredClone(defaultConfiguration);
    const save = vi.fn((value: unknown) => { stored = configurationSchema.parse(value); return structuredClone(stored); });
    const slot = renderSlot(app.settingsSections[0], {}, { rpc: { configuration: () => structuredClone(stored), saveConfiguration: save } });
    mounted.push(slot);
    const outcome = await slot.findByRole("combobox", { name: "Expected outcome 2" });
    fireEvent.change(outcome, { target: { value: "external" } });
    fireEvent.change(slot.getByRole("textbox", { name: "General rule 2" }), { target: { value: "All GitHub links belong in my main browser." } });
    expect(slot.getByText("Expected Main browser; gets BB default")).toBeTruthy();
    const applyButtons = slot.getAllByRole("button", { name: "Use domain rule" });
    fireEvent.click(applyButtons[1]);
    expect(slot.queryByText("Expected Main browser; gets BB default")).toBe(null);
    fireEvent.click(slot.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(stored.examples[1].narrative).toBe("All GitHub links belong in my main browser.");
    expect(stored.webRules[0]).toEqual({ pattern: "^https?://github\\.com([/:?#]|$)", action: "external" });
  });
  it("blocks invalid regexes, permits clearing the examples, and reveals file controls", async () => {
    const slot = renderSlot(app.settingsSections[0], {}, { rpc: { configuration: () => structuredClone(defaultConfiguration) } }); mounted.push(slot);
    const pattern = await slot.findByRole("textbox", { name: "URL pattern 1" });
    fireEvent.change(pattern, { target: { value: "[" } });
    expect(slot.getByRole("alert").textContent).toContain("Invalid URL pattern");
    expect((slot.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(pattern, { target: { value: "slack\\.com" } });
    fireEvent.click(slot.getByRole("button", { name: "Remove example 2" }));
    fireEvent.click(slot.getByRole("button", { name: "Remove example 1" }));
    expect(slot.getByText("Add a few links to show the behavior you want.")).toBeTruthy();
    expect(slot.getByRole("combobox", { name: "Default for file links", hidden: true })).toBeTruthy();
  });
});
