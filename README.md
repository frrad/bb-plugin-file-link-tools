# Link Rules

Route web links to your main browser or BB's usual link behavior. Choose sidebar file viewers by extension. A compact settings page holds ordered URL patterns, examples with expected outcomes, and file rules.

A fork of [File Link Tools](https://github.com/linniksa/bb-plugin-file-link-tools) by Sergey Linnik, with the preview cards, thumbnails, metadata summaries, long-press gestures and link decoration removed.

## Configure

Open **Link Rules** in the sidebar or **Settings → Link Rules**. The two tabs are Web and Files. Web shows URL rules and examples together; edits stay in place while switching tabs.

- **Web links:** choose the fallback and add URL regex rules. First match wins; reorder with the arrows. Patterns are case insensitive and use RE2 syntax (no backreferences or lookahead). Slack links open in your main browser by default; other web links open in the BB browser on desktop.
- **Examples & intent:** save example URLs, choose expected outcomes and describe what should happen to similar links. Each example reports whether the current rules agree. **Use domain rule** adds or updates a rule for that example's exact hostname at the top. Narrative text is saved intent, not an automatically executed instruction.
- **Try a link:** see the winning rule and destination before saving.
- **File links:** rules and examples appear side by side, like Web. Choose built-in preview, an installed viewer such as Office Viewer — PDF, or the file explorer. Code and text default to built-in preview; other files automatically use the first matching installed viewer, falling back to built-in preview. Folders open the BB file explorer.
- **File examples:** save a file path, desired viewer, and intent. Each example checks the same routing used by clicks. **Use extension rule** creates or updates the rule for that extension; Save changes applies it.

Click **Save changes** to apply edits. Empty web rule and example lists are supported.

Right-click a web link for its current default, one-off opening options, Copy link, Copy, Select all, and **Change default…**, which opens Web settings and adds that URL as a focused, editable example next to the rules. Save changes persists the example. Shift-right-click bypasses the plugin's menu. Modified clicks retain BB's behavior.

Right-click a verified file link for **Default: [viewer name]**, one-off installed viewers, file explorer, **More open options…**, copy actions, and **Change default…**. Change default opens Files settings with that file as a focused example, keeping existing draft edits. More open options and Shift-right-click retain BB’s original viewer/terminal menu. Unverified files retain BB’s menu. System application and system file manager actions remain separately labeled choices under “On the file host” in settings.

**BB browser** explicitly opens inside the desktop app and enables BB’s local “Open links in app browser” preference when needed. On web-only clients, the main browser is the fallback; the desktop-only menu option is disabled. **Main browser** opens on that same viewing device, even when the server or thread runs remotely. Slack uses the original HTTPS link, allowing your browser to hand off to Slack; direct `slack://` conversion is not performed.

## Install and develop

Requires BB with Plugin SDK 0.6.104+ and Node.js 22.6+.

```sh
bb plugin install git:https://github.com/frrad/bb-plugin-file-link-tools.git
```

From a checkout:

```sh
npm ci
npm run check
npm test
bb plugin build
bb plugin install .
```

The plugin ID is `link-rules`, separate from upstream's `file-link-tools`. Disable upstream's click overrides before using both together. CLI configuration is available with `bb link-rules settings show` and `settings set`.

Web rules apply to ordinary external HTTP(S) anchors in BB's app UI, including streamed messages. They leave BB routes, downloads, application schemes and embedded browser pages alone. File routing currently requires a thread on the primary server host. Sidebar viewers render on the viewing client; the backend supplies file bytes and synchronizes the selected viewer tab. Explicit system actions and custom commands run on the file host.

[Technical reference](docs/reference.md).
