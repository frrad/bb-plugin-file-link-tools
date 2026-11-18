# Link Rules

A minimal fork of [File Link Tools](https://github.com/linniksa/bb-plugin-file-link-tools) by Sergey Linnik. Keeps configurable file-link click actions and removes the hover cards, thumbnails, metadata summaries, long-press gestures and added link icons.

Choose a default file action, override it by extension, or launch a saved tool. Common code and text files open in BB; other files use their default application. Folders open in the file manager. Modified clicks and BB's context menu keep their usual behavior.

## Configure

Open **Settings → Link Rules**. The rule tester shows which action a filename selects. Custom commands accept `{path}`, `{line}` and `{column}`; arguments are parsed before substitution and run without a shell.

Agents can use `bb link-rules settings show`, `settings default`, `settings rule set/remove`, and `settings set`.

## Install and develop

Requires BB 0.47+ and Node.js 22.6+.

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

The plugin ID is `link-rules`, separate from upstream's `file-link-tools`.
Disable upstream's click overrides before using both plugins together.

## Current scope

This first fork handles existing local file and folder links. Web URL regex routing and direct Slack-app links are not implemented yet.

File actions require a thread on BB's primary server host and launch on that host. They do not open files on a remote viewing device. macOS was exercised upstream; Windows and Linux GUI behavior has not been verified here. BB's timeline DOM and the internal default-application daemon route remain compatibility dependencies inherited from upstream.

[Technical reference](docs/reference.md).
