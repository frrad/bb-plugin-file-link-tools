---
name: link-rules
description: Configure Link Rules web URL patterns, expected-outcome examples, and file-link actions.
---

# Link Rules

Read `bb link-rules settings show` first. Use `settings set '<json>'` for web rules or examples, preserving unrelated values. Web fields: `webDefault` is `bb` or `external`; `webRules` is an ordered list of `{pattern, action}`; `examples` contains `{url, action, narrative}`. First matching regex wins, otherwise the default. Patterns are case insensitive RE2 syntax. Empty lists are valid. Narrative text records intent; it is not executed automatically.

The settings page has a live URL tester and expected-outcome checks. Use domain rule creates an escaped exact-hostname regex at the top, replacing an identical existing rule. Right-clicking an external HTTP(S) anchor shows the current default and one-off options; Change default opens the Web tab and adds/focuses the URL as an editable example beside the rules. Existing examples are not duplicated; unrelated unsaved edits are kept. Save changes persists the new example. Main browser opens on the viewing device, not the server. BB browser explicitly opens inside the desktop app, enabling the device’s local in-app browser preference when needed. Web-only clients fall back to the main browser. Slack links use HTTPS browser handoff rather than slack:// conversion.

File actions can also use `settings default` and `settings rule set/remove`. Actions: `preview` (BB panel), `external` (default app), `folder`, or saved tool UUID. File tools split arguments before placeholder substitution and run without a shell. `{line}` and `{column}` default to 1. File operations require the primary server host; other files retain BB's handler. File previews are on-click BB panels, with no hover cards or decorations.

The `replaceDefaultClick` switch enables normal-click overrides for web and file links. Modified clicks, downloads, BB routes and embedded browser pages are untouched. See README.md and docs/reference.md for limits and compatibility dependencies.
