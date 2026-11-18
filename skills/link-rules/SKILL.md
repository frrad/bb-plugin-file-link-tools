---
name: link-rules
description: Configure Link Rules file-link click actions and custom tools.
---

# Link Rules

Read `bb link-rules settings show` before changing configuration. Use `settings default`, `settings rule set/remove`, or `settings set '<json>'`, preserving unrelated values. Actions are `preview` (BB side panel), `external` (default application), `folder`, or a saved tool UUID. See `bb link-rules --help`.

Settings → Link Rules has the same rules and custom tools. The `replaceDefaultClick` switch enables overrides. Folders open in the file manager; file extensions override the default action. Commands are split before placeholder substitution and run without a shell. Defaults for `{line}` and `{column}` are 1. Only saved tools may be launched by ID.

Only verified local `file://` links in timeline messages are handled. File operations run on the primary server host, not a remote viewing device. Missing or unverified links keep BB's handler. Modified clicks and context menus remain native. There are no hover cards, metadata summaries, inline previews, long-press gestures or added link icons. Preview actions open BB's own side panel only after a click.

Web URL regex rules are not implemented in this first fork. See the technical reference for inherited compatibility constraints and attribution.
