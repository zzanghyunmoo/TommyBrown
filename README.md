# TommyBrown

A desktop home for coding agents, shared model access, and connected work.

TommyBrown is under active development. The product contract is in
[the implementation plan](docs/plans/2026-10-02-tommybrown-desktop.md).

## Run on Windows

Install Node.js 24 and Bun, then run:

```sh
bun install --frozen-lockfile
bun run build
bun run start
```

In Model access, install the engine, start the gateway, and connect an account in
your browser. Open a workspace, choose Claude Code or Codex and a discovered model,
then start a terminal session. Routing applies to that session only. Install the chosen
CLI separately using its native installer or standard npm package; npm installations
also need Node.js on PATH. Custom shell wrappers are not supported.

The model-access page can also copy an opt-in PowerShell command for an external
terminal. That command contains a local gateway key and restores the previous
process environment when the CLI exits.

The gateway uses loopback port 8317. An occupied port produces an error; TommyBrown
does not stop other applications. Closing TommyBrown stops its own gateway.
Account files stay in local application data with Windows access restricted to the
current user. Application keys use OS encryption. Provider token files are managed
by CLIProxyAPI and are not encrypted by TommyBrown itself.

## Workspace and connectors

- Open a folder as a space. Run PowerShell, Claude Code, or Codex in real terminals.
  Terminal sessions stay alive when switching tabs and stop when closed or the app exits.
- Browse, edit, and save text in the right pane. Markdown has an offline preview.
  External edits produce a conflict instead of overwriting your draft.
- Click a terminal HTTP(S) link to open the right browser pane. Browser sessions have
  no local IPC or Node privileges; each connector has its own persistent session.
- Add browser, Slack/Discord, Jira/Linear, Confluence/Notion, or GitLab/GitHub web screens.
  Embedded login restrictions may require the external-browser button. External login
  does not transfer cookies into the embedded view.
- For agent data and tools, configure a trusted Streamable HTTP MCP endpoint and an
  optional bearer token. Web login is separate from MCP authentication. Inspect and
  explicitly run tools in the connector pane, or select connections for a new CLI session.
  OAuth-only MCP servers require an issued token or a compatible local adapter.
- Choose a local Obsidian vault to browse, search, preview, and edit Markdown offline.
  The Obsidian button opens the installed local app. Vault use does not require Sync
  or upload notes; remote images are suppressed in previews.

Spaces, document/browser tab selection, view settings, and connector definitions restore
after restart. Save drafts before quitting. Running processes and terminal output do not
resume after an application restart. Disconnecting a connector stops terminals using it
and removes its local definition, stored token, and embedded browser session.

## Windows package

```sh
bun run package:windows
```

The command writes `release/windows-<timestamp>/TommyBrown-win32-x64/`.
Run `TommyBrown.exe` from that folder and keep its companion files together. This is
an unsigned Windows x64 development build, not an installer or an auto-updating release.
Other operating systems and architectures have not been validated.

## Development status and verification

The gateway, ADE, connectors, offline vault, and Windows package are implemented.
Live provider consent, cross-CLI inference/streaming/tool use, authenticated named-service
integrations, and opening an actual installed Obsidian vault remain unverified.
The full product goal is therefore still open. See the
[desktop checkpoint](docs/verification/2026-10-03-desktop-workspace.md).

```sh
bun run check
bun run lint
bun run test
bun run build
bun run test:desktop
bun run smoke:proxy
```

Desktop and smoke tests download the pinned public gateway release. They use isolated
test data and do not complete provider consent or spend model credits.

To exercise a packaged build, set `TOMMYBROWN_PACKAGED_APP` to its executable before
running `bun run test:desktop`. These tests show temporary native windows and keep
screenshots and fixture data in ignored directories. Connector tests use local fixtures,
not live service accounts. `bun run doctor:react` currently reports reviewed advisory
findings; see the checkpoint for their disposition.

The intended experience combines:

- Claude Code, Codex, and Antigravity OAuth accounts behind a local CLIProxyAPI gateway.
- Spaces and agents on the left, working tabs above, and a code, Markdown, or browser pane on the right.
- Browser, chat, issue tracker, knowledge, and source control connectors, plus local-only Obsidian vaults.

## References

- [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI): upstream protocol translation and OAuth engine.
- [Quotio](https://github.com/nguyenphutrong/quotio): account management and CLI configuration reference.
- [Herdr](https://github.com/herdrdev/herdr): spaces and terminal-based agent workflow reference.

No upstream application code is copied into this repository. The proxy executable is
downloaded separately from an explicitly pinned upstream release and verified before use.
