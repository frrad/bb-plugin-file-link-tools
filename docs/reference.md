# Reference

Link Rules derives from [File Link Tools](https://github.com/linniksa/bb-plugin-file-link-tools). It retains file extension rules, custom commands, configuration synchronization, file verification and click actions. It adds web URL rules and a web-link menu. Preview cards, inline previews, summary enumeration, link decoration and long-press handling are removed.

## Web behavior

The app-wide overlay handles external HTTP(S) anchors on the viewing client. First matching pattern wins; otherwise `webDefault` applies. `bb` opens in BB’s desktop browser by enabling its client-local `bb.openLinksInAppBrowser` preference when needed, notifying BB synchronously, and then delegating to the original anchor’s panel context. This isolated compatibility dependency is in `browser-preference.ts`. It leaves the preference enabled. On clients without a desktop browser, ordinary clicks use the main browser and the menu disables the BB-browser option. `external` uses the viewing desktop's `bbDesktop.openExternalUrl`, or a normal new browser tab on web clients. It never asks the server to launch a browser. There is no public SDK method to force the main browser: the isolated desktop bridge call in `web-opening.ts` is a feature-checked compatibility dependency, to revalidate after BB upgrades.

The menu uses app DOM rather than Electron's native menu because BB exposes no public web-link menu contribution slot. It supports arrow keys, Home/End, Enter, Escape, outside click, focus restoration and viewport clamping. Copy uses BB's SDK clipboard API. Select all selects the main content containing the link. Shift-right-click keeps the native menu. Change default opens the plugin's own settings panel through SDK navigation and hands off a one-use example request through per-tab session storage. The Web tab opens with rules and examples together; the requested example is prepended and focused without losing existing draft edits. Existing URLs are focused rather than duplicated. Requests also reach an already-mounted settings page, and are consumed once. Normal modified clicks are left alone.

Web matching uses RE2JS, with linear-time matching and bounded pattern/URL sizes. Patterns are case insensitive; unsupported constructs produce validation errors. BB's origin, internal routes, relative/fragment links, downloads, credential-bearing URLs and other schemes are excluded. An embedded browser page is a separate document and is not intercepted.

Examples store an HTTP(S) URL, desired action and narrative. They are acceptance checks, not an AI rule generator. Applying an example builds an escaped exact-hostname rule, inserts it first, and replaces an existing identical pattern. Narratives remain editable context for people and agents. Up to 50 web rules and 30 examples are accepted. Old file-only configurations gain the initial Slack rule and examples through schema defaults; existing file choices are preserved.

## File behavior

The enable switch controls web and file normal-click overrides. Disabling it retains BB’s normal clicks while keeping one-off menus. Extension rules override the fallback. `bb` automatically chooses the first matching installed viewer, then built-in preview; `preview` explicitly selects built-in preview, `explorer` opens BB’s Project files sidebar. Explicit `viewer:<pluginId>:<openerId>` choices select a registered viewer, including Office Viewer and PDF viewer. This automatic policy belongs to Link Rules; it does not read or change BB’s separate file-opener preferences.

`file-viewers.ts` discovers enabled, compatible app bundles through the public plugin-list API and reads their public `PluginAppDefinition.setup` registration metadata using a file-opener-only collector. It never mounts foreign components in Link Rules’ plugin context. Imports are restricted to same-origin `/api/v1/plugin-app-assets/` URLs. Choices refresh on page focus; errors are shown in settings. This interpretation adapter should be revalidated when the host’s app registration contract changes.

`file-panels.ts` uses the public thread-tabs API with revision checks, preserving unrelated tabs. It constructs the same host preview/file-opener tab representation BB uses; tab IDs, the `file-opener:` action prefix and opener parameters are an isolated compatibility dependency to revalidate after BB upgrades. The frontend selects the synchronized tab with the public panel controller. The thread-scoped registration supplies the thread’s panel context. Line/range targets are carried to the selected viewer. Registered viewers render under their own plugin context, with the original BB preview available as their fallback.

The file and web menus share `LinkMenu`, including positioning, keyboard navigation, focus restoration, dismissal and portal rendering. Change default hands off a one-use file example request and opens Files settings with the example focused beside extension rules. It preserves existing draft edits and never duplicates an existing path. Each example stores a path, desired action, folder flag and narrative. Checks, the filename tester, and real file clicks share `destinationFor`. Use extension rule moves only that extension to the desired action, preserving other extensions in grouped rules. At most 30 file examples and 50 rules are accepted. Folders route to the BB file explorer and have no extension rule. Nothing is persisted until Save changes.

Legacy explicit system actions remain available in settings: `external` uses the host daemon’s `targetId: "default-app"` (an inherited internal route); `folder` reveals the path in the host’s system file manager. Custom tools run on that host too. These are distinct from sidebar viewers. The plugin no longer queries system application associations.

BB has no public file-menu contribution hook. More open options replays a contextmenu event on the original anchor with a synchronous bypass guard, retaining the host’s installed file openers and terminal menu. This depends on BB’s DOM contextmenu handler; Shift-right-click also bypasses interception directly. Revalidate this handoff after BB upgrades.

Custom tools accept `{path}`, `{line}` and `{column}`; arguments are split before substitution without shell expansion. A range uses its start; absent line/column default to 1. Windows scripts need an explicit interpreter. The server launches only saved tool IDs and rechecks target existence. Commands return after startup, not GUI application exit.

Visible `file://` targets are checked once per mounted view. Unknown or unverified files retain BB's handler. Observers and click listeners are disposed on unmount. File interception depends on BB's timeline attributes and its compatibility-supported thread header slot. Web interception uses the current app-overlay slot.

Configuration is validated server-side, stored in plugin KV, and synchronized through realtime events. Concurrent saves are last-write-wins; the editor warns about intervening changes. There is no settings migration from upstream's separate plugin ID.

## Attribution and validation

File revealing is adapted from [reveal-file 0.1.2](https://github.com/sindresorhus/reveal-file), under [its MIT license](../LICENSE.reveal-file). Windows/Linux GUI file execution has not been verified here; WSL is unsupported. Retained Button and Tooltip vendored source is under [BB's license](../LICENSE.BB).

Run `npm ci`, `npm run check`, `npm test`, and `bb plugin build`. Tests cover schema migration, regex precedence and validation, hostname escaping, click modifiers, menu behavior and cleanup, one-off BB opening, and example editing/saving. Reload a local installation with `bb plugin reload link-rules`.
