import { useEffect, useRef, useState } from "react";
import { useRpc } from "@get-bb/plugin-sdk/app";
import { builtInActions, configurationSchema, type Configuration } from "./actions";
import { applyExample, domainPattern, webActionFor, webActionLabels, webActions, webUrl, type LinkExample, type WebAction, type WebRule } from "./web-rules";
import type { rpcContract } from "./server";
import { useConfiguration } from "./use-configuration";
import { exampleRequestEvent, exampleRequestKey, readExampleRequest } from "./example-request";
import { fileExtension, fileRequestEvent, fileRequestKey, readFileRequest } from "./file-request";
import { useFileViewers } from "./file-viewers";
import { destinationFor, destinationLabels, destinationLabel } from "./file-destinations";
import { applyFileExample, type FileExample } from "./file-rules";
import "./settings.css";

type Draft = Omit<Configuration, "rules"> & { rules: { extensions: string; action: string }[] };
const toDraft = (config: Configuration): Draft => ({ ...structuredClone(config), rules: config.rules.map(rule => ({ ...rule, extensions: rule.extensions.join(", ") })) });
const toConfig = (draft: Draft) => ({ ...draft, rules: draft.rules.map(rule => ({ ...rule, extensions: rule.extensions.toLowerCase().split(",").map(ext => ext.trim()).filter(Boolean) })) });
export function WebActionSelect({ value, onChange, label }: { value: WebAction; onChange(value: WebAction): void; label: string }) {
  return <select aria-label={label} value={value} onChange={event => onChange(event.target.value as WebAction)}>
    {webActions.map(action => <option key={action} value={action}>{webActionLabels[action]}</option>)}
  </select>;
}
export function FileLinkSettings() {
  const rpc = useRpc<typeof rpcContract>();
  const { viewers, error: viewersError } = useFileViewers();
  const { config, error, reload } = useConfiguration();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [base, setBase] = useState<Configuration | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pendingExample, setPendingExample] = useState(readExampleRequest);
  const [focusedExample, setFocusedExample] = useState<{ url: string; id: string } | null>(null);
  const examplesRoot = useRef<HTMLDivElement>(null);
  const [sample, setSample] = useState(() => readExampleRequest()?.url ?? "https://modal.enterprise.slack.com/archives/C123");
  const [tab, setTab] = useState<"web" | "files">("web");
  const [pendingFile, setPendingFile] = useState(readFileRequest);
  const [focusedFile, setFocusedFile] = useState<{ path: string; id: string } | null>(null);
  const filesRoot = useRef<HTMLElement>(null);
  const [filename, setFilename] = useState("photo.png");
  const dirty = !!draft && JSON.stringify(toConfig(draft)) !== JSON.stringify(base);
  useEffect(() => {
    if (config && !dirty) { setDraft(toDraft(config)); setBase(config); }
  }, [config, dirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    const receive = () => setPendingExample(readExampleRequest());
    window.addEventListener(exampleRequestEvent, receive);
    return () => window.removeEventListener(exampleRequestEvent, receive);
  }, []);
  useEffect(() => {
    if (!draft || !pendingExample) return;
    const existing = draft.examples.find(example => example.url === pendingExample.url);
    setTab("web"); setSample(pendingExample.url);
    if (!existing && draft.examples.length >= 30) {
      setSaveError("Remove an example to make room for this link (30 maximum).");
      return;
    }
    const example = existing ?? { url: pendingExample.url, action: pendingExample.action ?? webActionFor(config!, pendingExample.url)?.action ?? draft.webDefault, narrative: "" };
    if (draft.examples[0] !== existing || !existing) {
      setDraft({ ...draft, examples: [example, ...draft.examples.filter(item => item !== existing)] });
      setSaved(false);
    }
    setFocusedExample({ url: example.url, id: pendingExample.id }); setSaveError(null);
    if (readExampleRequest()?.id === pendingExample.id) sessionStorage.removeItem(exampleRequestKey);
    setPendingExample(null);
  }, [config, draft, pendingExample]);
  useEffect(() => {
    if (!focusedExample) return;
    const card = Array.from(examplesRoot.current?.querySelectorAll<HTMLElement>("[data-example-url]") ?? []).find(element => element.dataset.exampleUrl === focusedExample.url);
    if (card) {
      card.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      card.querySelector<HTMLSelectElement>("select")?.focus({ preventScroll: true });
    }
  }, [focusedExample]);
  useEffect(() => {
    const receive = () => setPendingFile(readFileRequest());
    window.addEventListener(fileRequestEvent, receive);
    return () => window.removeEventListener(fileRequestEvent, receive);
  }, []);
  useEffect(() => {
    if (!draft || !pendingFile) return;
    setTab("files"); setFilename(pendingFile.path);
    const existing = draft.fileExamples.find(example => example.path === pendingFile.path);
    if (!existing && draft.fileExamples.length >= 30) { setSaveError("Remove a file example to make room (30 maximum)."); return; }
    const example = existing ?? { path: pendingFile.path, action: pendingFile.action ?? draft.defaultAction, directory: pendingFile.directory ?? false, narrative: "" };
    if (!existing || draft.fileExamples[0] !== existing) {
      setDraft({ ...draft, fileExamples: [example, ...draft.fileExamples.filter(item => item !== existing)] });
      setSaved(false);
    }
    setFocusedFile({ path: pendingFile.path, id: pendingFile.id });
    if (readFileRequest()?.id === pendingFile.id) sessionStorage.removeItem(fileRequestKey);
    setPendingFile(null);
  }, [draft, pendingFile]);
  useEffect(() => {
    if (!focusedFile) return;
    const card = Array.from(filesRoot.current?.querySelectorAll<HTMLElement>("[data-file-example-path]") ?? []).find(element => element.dataset.fileExamplePath === focusedFile.path);
    card?.scrollIntoView?.({ block: "nearest" }); card?.querySelector<HTMLSelectElement>("select")?.focus({ preventScroll: true });
  }, [focusedFile]);
  if (!draft || !config) return <div className="lr-settings"><p role={error ? "alert" : "status"}>{error ?? "Loading rules…"}</p>{error && <button onClick={() => void reload()}>Retry</button>}</div>;
  const parsed = configurationSchema.safeParse(toConfig(draft));
  const checked = parsed.success ? parsed.data : null;
  const sampleResult = checked ? webActionFor(checked, sample) : null;
  const fileLabels = destinationLabels(draft, viewers);
  function edit(next: Draft) { setDraft(next); setSaved(false); setSaveError(null); }
  function patchRule(index: number, patch: Partial<WebRule>) { edit({ ...draft!, webRules: draft!.webRules.map((rule, i) => i === index ? { ...rule, ...patch } : rule) }); }
  function patchExample(index: number, patch: Partial<LinkExample>) { edit({ ...draft!, examples: draft!.examples.map((example, i) => i === index ? { ...example, ...patch } : example) }); }
  function move(index: number, by: number) {
    const rules = [...draft!.webRules];
    [rules[index], rules[index + by]] = [rules[index + by], rules[index]];
    edit({ ...draft!, webRules: rules });
  }
  function fileSelect(value: string, onChange: (action: string) => void, label: string) {
    const actions = [...builtInActions.filter(action => action !== "external" && action !== "folder"), ...viewers.map(viewer => viewer.action), ...draft!.tools.map(tool => tool.id)];
    if (!actions.includes(value) && value !== "external" && value !== "folder") actions.push(value);
    return <select aria-label={label} value={value} onChange={event => onChange(event.target.value)}>
      {actions.map(action => <option key={action} value={action}>{destinationLabel(action, fileLabels)}</option>)}
      <optgroup label="On the file host"><option value="external">System application on file host</option><option value="folder">System file manager on file host</option></optgroup>
    </select>;
  }
  function patchFileExample(index: number, patch: Partial<FileExample>) {
    edit({ ...draft!, fileExamples: draft!.fileExamples.map((example, i) => i === index ? { ...example, ...patch } : example) });
  }
  async function save() {
    if (!parsed.success) return;
    setBusy(true); setSaveError(null);
    try {
      const next = await rpc.call("saveConfiguration", parsed.data);
      setBase(next); setDraft(toDraft(next)); setSaved(true); await reload();
    } catch (cause) { setSaveError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }
  return <div className="lr-settings" data-link-rules>
    <header className="lr-heading"><div><h2>Where links open</h2><p>Set destinations, add exceptions, and check your examples.</p></div></header>
    <nav className="lr-tabs" role="tablist" aria-label="Link settings sections">{([ ["web", "Web", draft.webRules.length], ["files", "Files", draft.rules.length] ] as const).map(([id, title, count]) => <button key={id} id={`lr-tab-${id}`} role="tab" aria-label={title} aria-selected={tab === id} aria-controls={`lr-panel-${id}`} onClick={() => setTab(id)} onKeyDown={event => {
      const tabs = ["web", "files"] as const;
      const index = tabs.indexOf(id);
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault(); const next = tabs[(index + 1) % 2]; setTab(next); document.getElementById(`lr-tab-${next}`)?.focus();
    }} tabIndex={tab === id ? 0 : -1}>{title}<span aria-hidden="true">{count}</span></button>)}</nav>
    <fieldset disabled={busy}>
      <div className="lr-tab-panels">
        <section id="lr-panel-web" role="tabpanel" aria-labelledby="lr-tab-web" hidden={tab !== "web"}>
          <div className="lr-default"><div><h3>Default destination</h3><p>For web links without a matching rule.</p></div><WebActionSelect label="Default for web links" value={draft.webDefault} onChange={webDefault => edit({ ...draft, webDefault })} /></div>
          <div className="lr-web-grid"><section className="lr-web-rules" aria-label="URL rules">
          <div className="lr-section-heading"><div><h3>URL rules</h3><p className="lr-hint">Exceptions to the default. First match wins.</p></div><button className="lr-add-button" disabled={draft.webRules.length >= 50} onClick={() => edit({ ...draft, webRules: [...draft.webRules, { pattern: "", action: draft.webDefault }] })}>+ Add rule</button></div>
          <div className="lr-table-heading"><span>URL pattern</span><span>Open in</span></div>
          <div className="lr-list lr-rule-list">
            {draft.webRules.map((rule, index) => <div className="lr-rule" key={index}>
              <div className="lr-rule-main"><input aria-label={`URL pattern ${index + 1}`} className="lr-mono" value={rule.pattern} spellCheck={false} placeholder="^https://example\.com/" onChange={event => patchRule(index, { pattern: event.target.value })} /><WebActionSelect label={`Web action ${index + 1}`} value={rule.action} onChange={action => patchRule(index, { action })} /></div>
              <div className="lr-rule-controls"><small>Rule {index + 1}</small><button aria-label={`Move rule ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button aria-label={`Move rule ${index + 1} down`} disabled={index === draft.webRules.length - 1} onClick={() => move(index, 1)}>↓</button><button aria-label={`Remove web rule ${index + 1}`} onClick={() => edit({ ...draft, webRules: draft.webRules.filter((_, i) => i !== index) })}>×</button></div>
            </div>)}
            {!draft.webRules.length && <p className="lr-empty">All web links use the default above.</p>}
          </div>
          <div className="lr-tester"><label htmlFor="lr-sample">Check a link</label><input id="lr-sample" value={sample} spellCheck={false} onChange={event => setSample(event.target.value)} /><p role="status">{sampleResult ? <><strong>{webActionLabels[sampleResult.action]}</strong><span> · {sampleResult.ruleIndex < 0 ? "Default destination" : `Rule ${sampleResult.ruleIndex + 1}`}</span></> : checked ? "Enter an HTTP(S) link" : "Fix the rules to test a link"}</p></div>
        </section>
        <section className="lr-web-examples" aria-labelledby="lr-examples-title">
          <div className="lr-section-heading"><h3 id="lr-examples-title">Examples</h3><button className="lr-add-button" disabled={draft.examples.length >= 30} onClick={() => edit({ ...draft, examples: [...draft.examples, { url: webUrl(sample) ?? "https://example.com/", action: sampleResult?.action ?? draft.webDefault, narrative: "" }] })}>+ Add example</button></div>
          <p className="lr-hint">Expected outcomes for sample links. Checked against your rules.</p>
          <div ref={examplesRoot} className="lr-list lr-example-list">
            {draft.examples.map((example, index) => {
              const actual = checked ? webActionFor(checked, example.url) : null;
              const passes = actual?.action === example.action;
              return <div className="lr-example" key={index} data-example-url={example.url} data-highlighted={example.url === focusedExample?.url || undefined}>
                <div className="lr-example-top"><input aria-label={`Example URL ${index + 1}`} value={example.url} spellCheck={false} onChange={event => patchExample(index, { url: event.target.value })} /><WebActionSelect label={`Expected outcome ${index + 1}`} value={example.action} onChange={action => patchExample(index, { action })} /></div>
                <label className="lr-intent-label">General rule<textarea aria-label={`General rule ${index + 1}`} rows={2} placeholder="What should happen to similar links?" value={example.narrative} maxLength={500} onChange={event => patchExample(index, { narrative: event.target.value })} /></label>
                <div className="lr-example-bottom"><div className="lr-example-status"><span className={actual ? passes ? "lr-pass" : "lr-mismatch" : "lr-caption"}>{actual ? passes ? "✓ Matches" : "✕ Doesn’t match" : "Not checked"}</span>{actual && !passes && <small className="lr-result-detail">Expected {webActionLabels[example.action]}; gets {webActionLabels[actual.action]}</small>}</div>
                  <button className="lr-text-button" disabled={!webUrl(example.url) || (draft.webRules.length >= 50 && !draft.webRules.some(rule => rule.pattern === domainPattern(example.url)))} onClick={() => edit({ ...draft, ...applyExample(draft, example) })}>Use domain rule</button>
                  <button aria-label={`Remove example ${index + 1}`} onClick={() => edit({ ...draft, examples: draft.examples.filter((_, i) => i !== index) })}>×</button>
                </div>
              </div>;
            })}
            {!draft.examples.length && <p className="lr-empty">Add a few links to show the behavior you want.</p>}
          </div>
        </section>
        </div></section>
      </div>
      <section ref={filesRoot} id="lr-panel-files" role="tabpanel" aria-labelledby="lr-tab-files" hidden={tab !== "files"} className="lr-files"><h3>File destinations</h3><p className="lr-hint">Choose sidebar viewers and match files by extension.</p>
        {viewersError && <p className="lr-error" role="alert">{viewersError}</p>}
        <div className="lr-file-content"><div className="lr-web-grid"><section aria-label="File rules"><h3>File rules</h3><div className="lr-inline"><label>Other files {fileSelect(draft.defaultAction, defaultAction => edit({ ...draft, defaultAction }), "Default for file links")}</label><span className="lr-hint">Folders open in the file explorer.</span></div>
          {draft.rules.map((rule, index) => <div className="lr-file-rule" key={index}><input aria-label={`Extensions ${index + 1}`} value={rule.extensions} onChange={event => edit({ ...draft, rules: draft.rules.map((r, i) => i === index ? { ...r, extensions: event.target.value } : r) })} />{fileSelect(rule.action, action => edit({ ...draft, rules: draft.rules.map((r, i) => i === index ? { ...r, action } : r) }), `File action ${index + 1}`)}<button aria-label={`Remove file rule ${index + 1}`} onClick={() => edit({ ...draft, rules: draft.rules.filter((_, i) => i !== index) })}>×</button></div>)}
          <button className="lr-text-button" disabled={draft.rules.length >= 50} onClick={() => edit({ ...draft, rules: [...draft.rules, { extensions: "", action: draft.defaultAction }] })}>+ File rule</button>
          <div className="lr-inline"><label htmlFor="lr-filename">Try a filename</label><input id="lr-filename" value={filename} onChange={event => setFilename(event.target.value)} /><span role="status">{checked ? destinationLabel(destinationFor(checked, filename, viewers), fileLabels) : "Fix invalid rules first"}</span></div>
        </section>
        <section className="lr-web-examples" aria-labelledby="lr-file-examples-title">
          <div className="lr-section-heading"><h3 id="lr-file-examples-title">Examples</h3><button className="lr-add-button" disabled={draft.fileExamples.length >= 30} onClick={() => edit({ ...draft, fileExamples: [...draft.fileExamples, { path: filename || "report.pdf", action: draft.defaultAction, directory: false, narrative: "" }] })}>+ Add file example</button></div>
          <p className="lr-hint">Choose the desired outcome, then apply a rule for similar files.</p>
          <div className="lr-list lr-example-list">
          {draft.fileExamples.map((example, index) => {
            const actual = checked ? destinationFor(checked, example.path, viewers, example.directory) : null;
            const expected = checked ? example.action === "bb" ? destinationFor({ ...checked, defaultAction: "bb", rules: [] }, example.path, viewers, example.directory) : example.action : null;
            const available = !expected?.startsWith("viewer:") || viewers.some(viewer => viewer.action === expected);
            const passes = actual === expected && available;
            const extension = fileExtension(example.path);
            const canApply = !example.directory && /^\.[a-z0-9]+$/u.test(extension) && (draft.rules.length < 50 || draft.rules.some(rule => rule.extensions.split(",").map(ext => ext.trim().toLowerCase()).filter(Boolean).join(",") === extension));
            return <div className="lr-example" key={index} data-file-example-path={example.path} data-highlighted={example.path === focusedFile?.path || undefined}>
              <div className="lr-example-top"><input aria-label={`Example file ${index + 1}`} value={example.path} spellCheck={false} onChange={event => patchFileExample(index, { path: event.target.value })} />{fileSelect(example.action, action => patchFileExample(index, { action }), `Desired file outcome ${index + 1}`)}</div>
              <label className="lr-intent-label">General rule<textarea aria-label={`File intent ${index + 1}`} rows={2} placeholder="What should happen to similar files?" value={example.narrative} maxLength={500} onChange={event => patchFileExample(index, { narrative: event.target.value })} /></label>
              <label className="lr-hint"><input type="checkbox" checked={example.directory} onChange={event => patchFileExample(index, { directory: event.target.checked })} /> Folder</label>
              <div className="lr-example-bottom"><div className="lr-example-status"><span className={actual ? passes ? "lr-pass" : "lr-mismatch" : "lr-caption"}>{actual ? passes ? "✓ Matches" : "✕ Doesn’t match" : "Not checked"}</span>{actual && !passes && <small className="lr-result-detail">Expected {destinationLabel(expected!, fileLabels)}; gets {destinationLabel(actual, fileLabels)}{!available && " (viewer unavailable)"}</small>}</div>
                <button className="lr-text-button" disabled={!canApply} onClick={() => edit(toDraft(applyFileExample(toConfig(draft), example)))}>Use extension rule</button>
                <button aria-label={`Remove file example ${index + 1}`} onClick={() => edit({ ...draft, fileExamples: draft.fileExamples.filter((_, i) => i !== index) })}>×</button>
              </div>
            </div>;
          })}
          {!draft.fileExamples.length && <p className="lr-empty">Add an example, or right-click a file and choose Change default…</p>}
          </div>
        </section></div>
          <details className="lr-tools"><summary>Custom tools</summary><p className="lr-hint">Use {'{path}'}, {'{line}'} and {'{column}'}. Quote arguments with spaces. Commands run on the server host, without a shell.</p>
            {draft.tools.map((tool, index) => <div className="lr-file-rule" key={tool.id}><input aria-label={`Tool name ${index + 1}`} value={tool.name} placeholder="Name" onChange={event => edit({ ...draft, tools: draft.tools.map((t, i) => i === index ? { ...t, name: event.target.value } : t) })} /><input aria-label={`Tool command ${index + 1}`} value={tool.command} placeholder={'code "{path}"'} onChange={event => edit({ ...draft, tools: draft.tools.map((t, i) => i === index ? { ...t, command: event.target.value } : t) })} /><button aria-label={`Remove tool ${index + 1}`} disabled={draft.defaultAction === tool.id || draft.rules.some(rule => rule.action === tool.id) || draft.fileExamples.some(example => example.action === tool.id)} onClick={() => edit({ ...draft, tools: draft.tools.filter(t => t.id !== tool.id) })}>×</button></div>)}
            <button className="lr-text-button" disabled={draft.tools.length >= 50} onClick={() => edit({ ...draft, tools: [...draft.tools, { id: crypto.randomUUID(), name: "", icon: "Terminal", command: "" }] })}>+ Custom tool</button>
          </details>
        </div>
      </section>
    </fieldset>
    {!parsed.success && dirty && <p className="lr-error" role="alert">{parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join(" · ")}</p>}
    {saveError && <p className="lr-error" role="alert">{saveError}</p>}
    {dirty && JSON.stringify(base) !== JSON.stringify(config) && <p className="lr-error" role="alert">Rules changed in another window. Discard to load them, or save to replace them.</p>}
    <footer className="lr-footer"><span role="status">{busy ? "Saving…" : saved ? "Saved" : dirty ? "Unsaved changes" : "All changes saved"}</span><div><button disabled={!dirty || busy} onClick={() => { setDraft(toDraft(config)); setBase(config); setSaveError(null); setSaved(false); }}>Discard</button><button className="lr-primary" disabled={!dirty || !parsed.success || busy} onClick={() => void save()}>Save changes</button></div></footer>
  </div>;
}
