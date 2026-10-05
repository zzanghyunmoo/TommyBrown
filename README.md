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
your browser. Open a workspace, choose Claude Code, Codex, or Antigravity and a discovered model,
then start a terminal session. Routing applies to that session only. Install the chosen
CLI separately using its native installer or standard npm package; npm installations
also need Node.js on PATH. Custom shell wrappers are not supported.
Antigravity uses the native `agy` executable. Its selected model uses the gateway's
OpenAI-compatible endpoint without changing global CLI settings.

The model-access page can also copy an opt-in PowerShell command for an external
terminal. That command contains a local gateway key and restores the previous
process environment when the CLI exits.

In **Model mappings**, connect corresponding OpenAI, Claude, and Antigravity model
IDs in a row, then choose the execution provider for each CLI. The model selector
uses that CLI's source column and previews the target provider and model before
launch. Both directions between every provider pair are supported. Example rows
are editable shorthand; replace execution targets with actual IDs from your account.
Claude's Opus, Sonnet, and Haiku shortcuts can be assigned to rows; unassigned
shortcuts use the selected session model. Settings persist after restart. Reopen
CLI sessions after changing mappings, and refresh the model selector if its preview
is outdated. See the [mapping guide](docs/solutions/architecture-patterns/provider-model-mapping.md).

The gateway uses loopback port 8317. An occupied port produces an error; TommyBrown
does not stop other applications. Closing TommyBrown stops its own gateway.
Account files stay in local application data with Windows access restricted to the
current user. Application keys use OS encryption. Provider token files are managed
by CLIProxyAPI and are not encrypted by TommyBrown itself.

## Workspace and connectors

- Start with one working area and switch between Terminal, Code/Documents, and
  Connectors tabs. Opening a browser, terminal link, app, or connector web screen
  automatically opens the right split. Browser and app are peer tabs there; closing
  that split restores the working area width while retaining web state. Drag dividers,
  explicitly split terminals, or zoom a pane. Apps are web screens, not arbitrary
  embedded Windows application windows.
- Open a folder as a space. Run PowerShell, Claude Code, Codex, or Antigravity in real terminals.
  Terminal sessions stay alive when switching tabs and stop when closed or the app exits.
- Browse, edit, and save text in the Code/Documents tab. Markdown has an offline preview.
  External edits produce a conflict instead of overwriting your draft.
- Click a terminal HTTP(S) link to open the right browser pane. Browser sessions have
  no local IPC or Node privileges; each connector has its own persistent session.
- Add browser, Slack/Discord, Jira/Linear, Confluence/Notion, or GitLab/GitHub web screens.
  Embedded login restrictions may require the external-browser button. External login
  does not transfer cookies into the embedded view.
- For agent data and tools, configure a trusted Streamable HTTP MCP endpoint and an
  optional bearer token. Web login is separate from MCP authentication. Inspect and
  explicitly run tools in the connector pane, or select connections for a new CLI session.
  Per-session connector injection supports Claude Code and Codex. Manage Antigravity
  MCP connections in its own CLI; TommyBrown does not rewrite that global configuration.
  OAuth-only MCP servers require an issued token or a compatible local adapter.
- Choose a local Obsidian vault to browse, search, preview, and edit Markdown offline.
  The Obsidian button opens the installed local app. Vault use does not require Sync
  or upload notes; remote images are suppressed in previews.

Spaces, each space's pane layout, independent browser/app tabs, document selection,
view settings, and connector definitions restore
after restart. Save drafts before quitting. Running processes and terminal output do not
resume after an application restart. Disconnecting a connector stops terminals using it
and removes its local definition, stored token, and embedded browser session.

## Workbench shortcuts

Press `Ctrl+B`, release it, then press the action key. These match Herdr's bindings
for the supported workbench actions and work inside embedded web pages as well.

| Key after Ctrl+B | Action |
| --- | --- |
| `c` | New tab or terminal session in the focused pane |
| `v` / `-` | Split a terminal to the right / below |
| `h` / `j` / `k` / `l` | Focus left / down / up / right |
| `H` / `J` / `K` / `L` | Swap with the neighboring pane |
| `z` | Zoom / restore the focused pane |
| `r` | Resize with h/j/k/l or arrows; Enter/Escape finishes |
| `x` / `X` | Close the pane / active tab |
| `n` / `p` / `1`-`9` | Next / previous / numbered tab |
| `b` / `w` / `g` | Toggle sidebar / find workspace / find session |
| `N` / `?` | Open a workspace / searchable shortcut help |

Press `Ctrl+B` twice to send one literal Ctrl+B to the client. Escape cancels a
pending prefix. Herdr's detached server, worktree commands, and copy-mode editor
are not part of this workbench. Layouts allow up to eight panes and sixteen web
tabs total; closing a terminal pane confirms before ending its running sessions.
The primary working area stays mounted; its close action closes the active tab.
Arrow keys and Home/End switch working-area and right-side tabs.

## Windows package

```sh
bun run package:windows
```

The command writes `release/windows-<timestamp>/TommyBrown-win32-x64/`.
Run `TommyBrown.exe` from that folder and keep its companion files together. This is
an unsigned Windows x64 development build, not an installer or an auto-updating release.
Other operating systems and architectures have not been validated.

## Development status and verification

The tabbed workspace supersedes the initial simultaneous three-pane default.
See the [tabbed workspace checkpoint](docs/verification/2026-10-05-tabbed-workspace.md)
for Antigravity routing, native captures, restart behavior and compact-window validation.

The gateway, ADE, connectors, offline vault, and Windows package are implemented.
An OpenAI account connected by the owner has served real Codex and Claude Code
responses through the gateway. Claude Code streaming and a real Read tool call passed;
the isolated Codex file-read check was blocked by local execution policy. See the
[live CLI checkpoint](docs/verification/2026-10-05-openai-cli.md).
Claude and Antigravity provider consent, authenticated named-service integrations,
and opening an actual installed Obsidian vault remain unverified. The full product
goal is still open. See the [desktop checkpoint](docs/verification/2026-10-03-desktop-workspace.md)
for the broader implementation and packaged tests.

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
- Spaces and agents on the left, working tabs in the main area, and browser/app tabs on the right when opened.
- Browser, chat, issue tracker, knowledge, and source control connectors, plus local-only Obsidian vaults.

## References

- [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI): upstream protocol translation and OAuth engine.
- [Quotio](https://github.com/nguyenphutrong/quotio): account management and CLI configuration reference.
- [Herdr](https://github.com/herdrdev/herdr): spaces and terminal-based agent workflow reference.

No upstream application code is copied into this repository. The proxy executable is
downloaded separately from an explicitly pinned upstream release and verified before use.
