---
title: TommyBrown desktop agent workspace
date: 2026-10-02
type: feat
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: user-goal
execution: code
---

# TommyBrown desktop agent workspace

## Goal Capsule

Build the user's desktop application in this repository, registered as the
`projects/TommyBrown` workspace submodule. Deliver shared CLI models first, then the
ADE, then connectors without dropping any part of the original request.

Completion requires observed desktop behavior and live integration evidence. A build,
mock transport, screenshot, or unauthenticated health check alone is insufficient.
User account consent is interactive; incomplete consent remains an explicit verification gap.

## Product Contract

### Requirements

| ID | Requirement | Observable acceptance |
| --- | --- | --- |
| R1 | Claude Code, Codex, Antigravity login | Each account can complete its upstream OAuth flow and appear with its real status. |
| R2 | Share models across CLIs | A model from one account is selected and successfully used through another CLI; streaming and tools work. |
| R3 | Manage the local gateway | Install verified engine, start/stop, readiness/errors, discover live models, retain accounts across restart. |
| R4 | Herdr-inspired ADE | Native desktop window, left spaces/agents, top tabs, real interactive agent terminals. |
| R5 | Right code/Markdown pane | Browse a chosen workspace, edit and save text, preview Markdown, switch tabs without losing drafts. |
| R6 | Browser and terminal links | Open a terminal URL in the right browser tab, navigate back/forward/reload, isolate remote pages from local privileges. |
| R7 | Connector registry | Add/disconnect browser, Slack/Discord, Jira/Linear, Confluence/Notion, GitLab/GitHub connections with explicit status and capabilities. |
| R8 | Connector screens | Open connected web applications in the right pane with persistent, isolated sessions; support external-browser fallback for blocked embedded login. |
| R9 | Offline Obsidian | Choose a local vault, browse/search/read/edit Markdown offline, and open the local Obsidian app. No cloud dependency or upload. |
| R10 | Durable application | Restore spaces, selected tabs, connector definitions, and settings; preserve secret separation; provide a Windows build and run instructions. |

### Flows and edge cases

1. Open Model access, install the pinned gateway, start it, select a provider, complete
   browser consent, poll login state, then list usable models. Cancel, timeout, denied
   consent, provider unavailability, port conflict, and engine exit must be visible.
2. Launch an agent in a selected space with a selected model. Set routing only in that
   subprocess environment or generated opt-in launch command. Existing global CLI
   configuration stays user-owned. Routing failures must not silently use a native account.
3. Open a repository directory as a space; launch multiple terminals; keep terminal state
   when switching spaces/tabs. Stop an agent intentionally; clean up owned processes on exit.
4. Browse/edit a file on the right. Retain unsaved drafts; confirm discard on close; detect
   external changes before overwrite. Reject paths escaping the selected root through traversal
   or symlinks. Markdown does not execute HTML or arbitrary URL schemes.
5. Configure a connector and open its web screen. Authentication sessions remain local.
   Distinguish web-session access from API/MCP capabilities; an icon and URL do not prove an
   agent data connector. Implement data/tool access via explicit supported adapters/MCP.
6. Select an Obsidian vault, edit a note while offline, and launch its local app URI. Never
   require Obsidian Sync, publish a vault, or send vault contents to connector services.

### Scope decisions

- The initial authoritative runtime is Windows, matching the current workspace. Use
  portable modules and document untested operating systems instead of claiming parity.
- Build a desktop app with its own workflow rather than copying Herdr or Quotio source.
- Browser sessions, credentials, gateway files, and workspace metadata live in local
  application data, outside repository content.
- No remote hosting, team accounts, payment system, or cloud vault synchronization is required.

## Planning Contract

### Key Technical Decisions

- **Electron + React + TypeScript**: real Chromium app views, native file dialogs,
  sandboxed preload IPC, and mature PTY/editor libraries suit the requested Windows ADE.
  Tauri is lighter but embedding arbitrary independently authenticated app pages and
  terminal integration would add platform-specific work here.
- **CLIProxyAPI sidecar**: pin v8.0.10 and verify upstream release checksums. Use its public
  v8 management routes for OAuth, account state, and models; delegate translation and
  token refresh to upstream. Do not rebuild provider protocols or scrape credentials.
- **Loopback isolation**: bind to 127.0.0.1, use separate random management/client keys,
  disable upstream web management UI, and reject IPC from untrusted frames.
- **Native secret storage**: Electron safeStorage for app-owned keys, no plaintext fallback;
  provider token files use the proxy's dedicated local auth directory with restrictive
  filesystem access. They never cross into the renderer or repository.
- **PTY + xterm**: use a real pseudo-terminal. Do not emulate a terminal with buffered
  child-process output. Host terminal lifecycle in main and retain it across view switches.
- **Monaco + Markdown preview**: separate dirty buffers from filesystem persistence and
  render Markdown through safe React elements. Relative links resolve inside the root.
- **WebContentsView**: each connector uses an isolated persistent session partition with
  sandbox, no preload/Node privileges, safe navigation, and explicit permission handling.
- **Connector capabilities**: web-session tabs, configured MCP/data access, and local vault
  filesystem capabilities are separate, inspectable states. Secrets remain in main.

### Dependencies and sequencing

U1 precedes U2; U2 model routing precedes U3 agent integration. U4 builds on U3 layout.
U5 builds on U3 browser and U4 filesystem primitives. U6 verifies the complete product.
Execute sequentially, as required by workspace instructions.

## Implementation Units

### U1. Repository and desktop foundation

- Files: `package.json`, `src/main/`, `src/preload/`, `src/shared/`, `src/renderer/`, `DESIGN.md`.
- Approach: establish native app shell, typed narrow IPC, local settings, packaging scripts.
- Verification: strict typecheck/build; actual Electron window and restart smoke.

### U2. Shared model gateway

- Files: `src/main/proxy/`, `src/shared/proxy.ts`, `src/renderer/features/models/`.
- Tests: `tests/proxy-config.test.ts`, `tests/proxy-client.test.ts`, `tests/proxy-runtime.test.ts`.
- Approach: verified installer, owned process, readiness, OAuth lifecycle, redacted account
  summaries, live model discovery, per-launch Claude/Codex/OpenAI-compatible configuration.
- Scenarios: checksum mismatch, offline install, malicious archive, port occupied,
  duplicate start, unexpected exit, no accounts, invalid management key, cancelled login,
  retry without duplicate OAuth, safe shutdown, model ID escaping.
- Verification: tests plus actual pinned binary; each provider consent and cross-CLI
  inference including streamed tool calls must be exercised before R1/R2 are complete.

### U3. Spaces, agents, terminals, browser

- Files: `src/main/workspace/`, `src/main/terminal/`, `src/main/browser/`, renderer workspace features.
- Tests: `tests/terminal.test.ts`, `tests/browser-policy.test.ts`, `tests/desktop.spec.ts`.
- Scenarios: multiple spaces/tabs, PTY resize, unicode/IME, input and exit, URL clicks,
  untrusted schemes, popup routing, renderer navigation attempt, restart restoration.
- Verification: desktop UI operations on a real PTY and native browser view; keyboard
  navigation, focus, minimum width, no pane overlap, and clean process shutdown.

### U4. Code and Markdown workspace

- Files: `src/main/files/`, renderer editor and file tree features.
- Tests: `tests/files.test.ts`, relevant scenarios in `tests/desktop.spec.ts`.
- Scenarios: nested files, traversal/symlink escape, binary/large file refusal, draft switching,
  external edit conflict, save, dirty close, Markdown unsafe HTML/link, offline operation.
- Verification: edit a temporary workspace file in the actual UI and observe saved content.

### U5. Connected tools and local Obsidian

- Files: `src/main/connectors/`, `src/shared/connectors.ts`, renderer connector features.
- Tests: `tests/connectors.test.ts`, `tests/vault.test.ts`, desktop connector scenarios.
- Scenarios: each named integration category, valid/invalid URL, connection failure,
  token persistence, disconnect clearing session/secret, MCP tool enumeration/call,
  vault search/read/write offline, vault traversal, local Obsidian URI.
- Verification: connect real authorized accounts where available; report missing consent
  separately from transport-level test evidence. Confirm no remote request for vault use.

### U6. Delivery and full acceptance

- Files: `README.md`, `docs/verification/`, `docs/solutions/`, package configuration.
- Verification: full tests/typecheck/build, packaged Windows app, manual desktop scenarios,
  security/correctness/code simplicity review, clean shutdown, public-safe diff inspection.

## Verification Contract

Use a project lockfile with `bun install --frozen-lockfile`. Gate on `bun run check`,
`bun run test`, and `bun run build`. Use `bun run test:desktop` and a real Windows session
for integrated evidence once the shell exists. Save sanitized evidence in
`docs/verification/`; keep screenshots with private state and test app data under ignored
`.local/` or `test-results/`.

## Definition of Done

Every R1-R10 requirement has matching observed evidence, the Windows app is runnable,
no required behavior remains a placeholder, account consent gaps are resolved, and the
full product passes desktop QA. Repository creation and early gateway tests are progress,
not completion of the active goal.

## Sources

- [CLIProxyAPI v8.0.10](https://github.com/router-for-me/CLIProxyAPI/tree/v8.0.10)
- [v8 management API](https://github.com/router-for-me/CLIProxyAPI/blob/v8.0.10/docs/management-api-v8.md)
- [Quotio](https://github.com/nguyenphutrong/quotio)
- [Herdr](https://github.com/herdrdev/herdr)

## Planning review

Coherence, feasibility, design, scope, and security reviewed sequentially under the parent
workspace policy. Resolved: v8 uses nested config and shared OAuth routes; real PTYs are
required; web tabs do not alone fulfill agent connector access; OAuth consent cannot be
simulated as live success; provider token storage must remain outside the renderer.
Deferred to execution: native PTY packaging and provider-specific OAuth consent behavior.
