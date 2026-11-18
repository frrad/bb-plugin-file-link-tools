# Reference

Link Rules is derived from [File Link Tools](https://github.com/linniksa/bb-plugin-file-link-tools). It retains extension rules, custom commands, configuration synchronization, locale selection, file verification and click actions. It removes all hover cards, inline previews, summary enumeration, link decoration and long-press handling.

## File actions

Settings → Link Rules chooses the default action, extension rules and custom tools. Disabling **Use configured file-link actions** preserves BB's native click behavior. Folders always use the file manager. Extensions match without case sensitivity; each extension has one rule. Configuration is validated server-side, stored in BB's plugin KV store and synchronized through realtime events. Concurrent saves use the last saved configuration; the editor warns about intervening changes.

**Preview in BB** opens BB's own side panel on click, preserving line and range locations. There is no plugin preview card or file-content read. **Default application** invokes BB's host daemon with `targetId: "default-app"`; this internal route must be revalidated after BB upgrades. File operations require a thread on the primary host. This fork has a separate plugin ID and does not migrate upstream's saved settings.

Custom tools use a single-line command with `{path}`, `{line}`, and `{column}`. Arguments are split before substitution without shell expansion. A range uses its starting line; absent line and column default to 1. Windows scripts require an explicit interpreter. The server launches only saved tool IDs and rechecks the target before launching. Commands return after process startup, not GUI application exit.

Only verified `file://` anchors in a thread's timeline receive click overrides. Each visible target is checked once per mounted view; external opening rechecks existence. Unverified links retain BB handling. Modified clicks and context menus are untouched. Listeners and observers are disposed on unmount. The timeline attributes used to identify links are a DOM compatibility dependency.

## Attribution

File revealing in `reveal-file.ts` is adapted from [reveal-file 0.1.2](https://github.com/sindresorhus/reveal-file) under [its MIT license](../LICENSE.reveal-file). Windows and Linux GUI execution has not been verified here; WSL is unsupported.

Button and Tooltip source comes from the [BB 0.47.1 registry](https://github.com/get-bb/bb/tree/desktop-v0.47.1/packages/plugin-registry/r), under [BB's license](../LICENSE.BB). These components are used only in settings.

## Development

Run `npm ci`, `npm run check`, `npm test`, and `bb plugin build`. Reload an installed local copy with `bb plugin reload link-rules`.
