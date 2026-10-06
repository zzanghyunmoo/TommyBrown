# TommyBrown

A desktop home for coding agents, shared model access, and connected work.

TommyBrown is under active development. The product contract is in
[the implementation plan](docs/plans/2026-10-02-tommybrown-desktop.md).

## Downloads

Download the matching archive from [GitHub Releases](https://github.com/zzanghyunmoo/TommyBrown/releases/latest):

| Computer | Archive |
| --- | --- |
| Windows x64 | `TommyBrown-0.1.1-windows-x64.zip` |
| Mac with Apple Silicon | `TommyBrown-0.1.1-macos-arm64.zip` |
| Mac with Intel | `TommyBrown-0.1.1-macos-x64.zip` |

On Windows, extract the entire ZIP and run `TommyBrown.exe`, keeping the other
files beside it. On macOS, extract and drag `TommyBrown.app` to Applications.
The app includes Electron and the Memory server. Install coding CLIs separately;
the managed model proxy downloads from settings on first use.

These builds have no publisher certificate or Apple notarization. Windows may
show SmartScreen; macOS may require **System Settings > Privacy & Security >
Open Anyway** after the first launch attempt. Only approve the app when its source
and checksum are trusted. Do not disable system-wide security protections.
SHA-256 files accompany the downloads. There is no automatic updater; replace the
application with a newer release while retaining its application-data folder.

From 0.1.1, packaged releases keep their settings in `TommyBrown Desktop` under
the OS application-data directory (`%APPDATA%` on Windows or
`~/Library/Application Support` on macOS). Development runs keep the original
`TommyBrown` profile. A release starts without development workspaces, vaults,
accounts or browser sessions, then restores its own saved settings on later runs.
The shared 0.1.0/development profile stays on disk and is not imported or deleted.
After upgrading from 0.1.0, select spaces and connect accounts in the new profile.
An explicit `TOMMYBROWN_DATA_DIR` still selects a custom profile for both app state
and browser storage.

macOS sessions use Bash and preserve saved model routing and MCP selections.
CLI discovery includes PATH, Homebrew, `~/.local/bin`, `~/.bun/bin` and
`~/.agy/bin`. An npm-based CLI needs Node.js available on that PATH.
Shell functions are local to the session; shell startup files are unchanged.

## Run from source on Windows or macOS

Install Node.js 24 and Bun, then run:

```sh
bun install --frozen-lockfile
bun run build
bun run start
```

In Model access, install the engine, start the gateway, and connect an account in
your browser. On subsequent app launches, the installed gateway starts automatically
with the saved accounts and mappings. Open a workspace, choose Claude Code, Codex, or
Antigravity and a discovered model, then start a terminal session. CLI and model choices
are saved separately for each CLI. Source builds include CLI installation in
**설정 > 일반·색상 > 코딩 에이전트**. A missing CLI also offers an install button in
the terminal panel. Existing native and standard npm installations remain usable;
npm installations need Node.js on PATH. Custom shell wrappers are not supported.
Antigravity uses the native `agy` executable. Its selected model uses the gateway's
OpenAI-compatible endpoint without changing global CLI settings.

New in-app PowerShell sessions apply the saved Claude and Antigravity model choices.
Run `claude`, `agy`, or `antigravity` there; Antigravity is also found in its native
Windows installation directory when the app inherited an older PATH. Choose **CLI existing
settings** to clear that CLI's saved routing. Reopen a session after changing its settings.
PowerShell has a colored prompt and PSReadLine syntax highlighting when available.
All terminal processes receive 256-color/truecolor capabilities, with light and dark ANSI palettes.
Select terminal text and press **Ctrl+Shift+C** to copy; **Ctrl+Shift+V** pastes the
Windows clipboard without adding Enter. Ordinary **Ctrl+C** still interrupts commands.
Multiline paste preserves the terminal application's bracketed-paste handling.

The model-access page can also copy an opt-in PowerShell command for an external
terminal. That command contains a local gateway key and restores the previous
process environment when the CLI exits.

In **Model mappings**, connect corresponding OpenAI, Claude, and Antigravity model
IDs in a row, then choose the execution provider for each CLI. The model selector
uses that CLI's source column and previews the target provider and model before
launch. Both directions between every provider pair are supported. **용도별 기본 매핑**
fills four editable task groups and shows their names in model selectors:

| Purpose | OpenAI | Claude | Gemini |
| --- | --- | --- | --- |
| Deep reasoning | Astra | Fable | Gemini 4 Argon |
| Complex coding | Sol | Opus | Pro |
| General coding | Terra | Sonnet | Flash |
| Fast tasks | Luna | Haiku | Flash-Lite |

These are purpose preferences, not equivalent benchmark scores. Existing choices and
routes are preserved. Registered account IDs are preferred; absent families use
explicit request aliases, marked as unavailable for execution on that provider.
Replace an execution target with an ID available from its connected account. Pro effort
variants belong to the same purpose group; a family alias does not set reasoning effort.
Argon and Flash-Lite are not currently listed among [Antigravity models](https://antigravity.google/docs/models).
`gemini-4-argon` is a request alias here, not a claim that the account has Google Argon access.

Claude's Fable, Opus, Sonnet, and Haiku shortcuts can be assigned to rows; unassigned
shortcuts use the selected session model. Settings persist after restart. Reopen
CLI sessions after changing mappings, and refresh the model selector if its preview
is outdated. See the [mapping guide](docs/solutions/architecture-patterns/provider-model-mapping.md).
Selecting `fable` preserves that Claude shortcut while its configured execution
provider receives the corresponding mapped model.

Antigravity's `/model` menu receives all mapped models for its execution provider.
Readable provider-scoped names such as `tb-agy-codex-gemini-4-argon` keep the selected
account unambiguous. The launch model is pinned explicitly because Antigravity restores
its previous selection; changing the menu affects that CLI session.

The gateway uses loopback port 8317. An occupied port produces an error; TommyBrown
does not stop other applications. Closing TommyBrown stops its own gateway.
Account files stay in local application data with Windows access restricted to the
current user. Application keys use OS encryption. Provider token files are managed
by CLIProxyAPI and are not encrypted by TommyBrown itself.

## Settings

Open **설정** from the header or sidebar, then choose a category:

- **프록시·모델**: proxy lifecycle, account connections, model mappings and CLI defaults.
- **일반·색상**: Bright/Dark colors, sidebar visibility, and coding-agent installation.
- **커넥터**: Slack and Atlassian account authorization, service tools and saved permissions.
- **MCP 게이트웨이**: gateway status, Context7/Memory/custom MCP servers and their permissions.

Connector and MCP settings work before opening a workspace. Changes update the terminal
tool selector. Switching settings retains unsaved inputs and live terminal
sessions; the last category, theme and sidebar choice restore after restarting.
The header theme selector remains available as a shortcut.
See the [settings checkpoint](docs/verification/2026-10-06-settings-categories.md).

Coding-agent installation is opt-in and uses the official native installers for
[Codex](https://learn.chatgpt.com/docs/codex/cli),
[Claude Code](https://code.claude.com/docs/en/setup), and
[Antigravity](https://www.antigravity.google/docs/cli/install/).
No Node.js or package manager is needed for these native installations. The vendor
installer may update the current user's PATH or shell integration. TommyBrown shows
progress and bounded logs, supports cancellation and retry, and verifies the installed
command with `--version`. Open a new terminal session afterward; restarting the app is
unnecessary. Existing sessions keep their original environment. **설치 다시 확인**
rescans externally installed CLIs. Installation does not connect accounts or change
saved model mappings. The published 0.1.1 download predates this installation UI.

## Workspace, web apps and service connectors

- Start with one working area and switch between Terminal, Code/Documents, and
  Web Apps tabs. Opening a browser, terminal link or web app
  automatically opens the right split. Browser and app are peer tabs there; closing
  that split restores the working area width while retaining web state. Drag dividers,
  explicitly split terminals, or zoom a pane. Apps are web screens, not arbitrary
  embedded Windows application windows.
- Open a folder as a space. Run PowerShell, Claude Code, Codex, or Antigravity in real terminals.
  Terminal sessions stay alive when switching tabs and stop when closed or the app exits.
- Browse, edit, and save text in the Code/Documents tab. Markdown has an offline preview.
  External edits produce a conflict instead of overwriting your draft.
- Click a terminal HTTP(S) link to open the right browser pane. Browser sessions have
  no local IPC or Node privileges; each web app has its own persistent session.
- Add browser, Slack/Discord, Jira/Linear, Confluence/Notion, or GitLab/GitHub web screens.
  Embedded login restrictions may require the external-browser button. External login
  does not transfer cookies into the embedded view.
- For service tools, open **설정 > 커넥터**, add Slack or Atlassian, then click **계정 연결**.
  Approve the account in the external browser, click **도구 확인**, choose allowed tools,
  and save their permissions. New service connectors initially block every tool.
  Atlassian registers its OAuth client automatically and requests access to your sites.
  Slack requires a registered internal or approved Slack app: enter its Client ID and
  Client Secret in the app and register `http://127.0.0.1:47931/oauth/callback` as its
  OAuth redirect URL. Changing Slack app credentials requires removing and re-adding
  that connector. The official [Slack MCP guide](https://docs.slack.dev/ai/slack-mcp-server/)
  describes supported apps and scopes.
- OAuth uses PKCE and a one-time callback state. Client registration, issuer-bound
  tokens and expiry stay in the OS-encrypted store; the renderer never receives them.
  Refresh is automatic when possible. Expired or revoked access asks you to reconnect;
  tool calls never open a login browser or automatically repeat failed write operations.
  Web-app cookies are independent of this service authorization.
- For other agent tools, open **설정 > MCP 게이트웨이** and register a trusted Streamable
  HTTP endpoint with an optional Bearer token. Inspect and explicitly run tools in
  that server's card. Before starting a CLI, select its service connectors and MCP
  servers under **이 세션의 도구 연결** in the terminal tab.
  The app starts a shared `tommybrown` MCP gateway automatically. Select connectors
  before opening Claude Code, Codex, Antigravity or PowerShell; the three CLI commands
  inside that PowerShell inherit the same selection. Global CLI configuration is unchanged.
  Each terminal receives a short-lived gateway credential; upstream tokens stay in the app.
  Claude Code and Codex have passed real MCP tool calls through the gateway. Antigravity
  1.2.17 discovers its tools, but its OpenAI model transport omits tool declarations and
  ignores tool-call responses. Actual tool invocation on that route remains blocked.
  OAuth-only custom servers other than the managed services require an issued token
  or a compatible local adapter. Atlassian API tokens are not Bearer tokens.
  The shared gateway exposes tools; MCP resources and prompts are not aggregated.
- Choose **Context7** in the MCP server form for the official documentation MCP
  endpoint. Anonymous access works at the service's lower rate limit; an optional
  API key goes in the access-token field. Choose **Memory** for the bundled official
  memory server (`@modelcontextprotocol/server-memory` 2026.8.31). It stores a local
  graph per connector in protected application data, survives restarts, and needs
  neither a global installation nor a login. Removing its connector retains the
  graph file; it does not erase remembered data.
- Click **도구 확인**, choose tools under **에이전트 도구 권한**, and click
  **권한 저장**. All-tools mode includes future tools; selecting individual tools
  creates an allowlist and excludes future additions. An empty selection blocks
  every tool. Saved restrictions apply to tool discovery, manual execution and
  agent calls, including cached tool names in existing sessions. Already dispatched
  operations are not undone. Start a new CLI session if its visible catalog is stale.
- Choose a local Obsidian vault to browse, search, preview, and edit Markdown offline.
  The Obsidian button opens the installed local app. Vault use does not require Sync
  or upload notes; remote images are suppressed in previews.

Spaces, each space's pane layout, independent browser/app tabs, document selection,
view settings, and connector definitions restore
after restart. Save drafts before quitting. Running processes and terminal output do not
resume after an application restart. Disconnecting a connector stops terminals using it
and removes its local definition, stored token, and embedded browser session.
Legacy mixed web/MCP registrations migrate into separate records. Web IDs and login
partitions are preserved; Context7/Memory IDs and Memory data remain unchanged.
See the [service connector checkpoint](docs/verification/2026-10-06-service-connectors.md)
for authentication evidence and account-validation limits.
Gateway access is revoked on terminal exit, launch failure or disconnection. Temporary
MCP configuration files contain only a local session credential and are stored in the
app's protected data directory. They are removed at exit or cleaned on the next startup;
credentials from a previous app run are invalid.

See the [shared MCP checkpoint](docs/verification/2026-10-06-shared-mcp-gateway.md)
for native CLI results and the remaining Antigravity limitation.
See the [tool permissions checkpoint](docs/verification/2026-10-06-mcp-tool-permissions.md)
for Context7/Memory execution, saved allowlists, and packaged desktop verification.
After building, `bun run scripts/mcp-smoke.ts` exercises both real MCP servers using
public documentation queries and temporary synthetic memory data.

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

## Native packages

```sh
bun run package:desktop
bun run test:release
bun run archive:release
```

Build on the target OS and architecture. `release/package.json` records the
package path; `release/assets/` contains the portable ZIP and its SHA-256 file.
`package:windows` remains available for local Windows development builds.
The Desktop packages GitHub Actions workflow builds on Windows x64, macOS arm64
and macOS x64. Each job launches its packaged app, opens a real PTY, calls Memory,
installs/starts the verified proxy and checks saved state after restart before
uploading an archive. Release publication uses these verified artifacts.

## Development status and verification

The tabbed workspace supersedes the initial simultaneous three-pane default.
See the [tabbed workspace checkpoint](docs/verification/2026-10-05-tabbed-workspace.md)
for Antigravity routing, native captures, restart behavior and compact-window validation.
See the [CLI restart checkpoint](docs/verification/2026-10-06-cli-restart-and-colors.md)
for automatic gateway startup, saved PowerShell routing, Fable, and terminal colors.

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
