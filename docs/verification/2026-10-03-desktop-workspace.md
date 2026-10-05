# Desktop workspace checkpoint - 2026-10-03

Windows x64, Node.js 24.11.1, Bun 1.3.14, Electron 44.5.1, CLIProxyAPI 8.0.10.
This records a development build on `feat/desktop-foundation`, not a merged release
or completion of the full product contract.

## Observed verification

| Check | Result |
| --- | --- |
| TypeScript and Biome | `bun run check` and `biome check --write .` passed. |
| Behavior tests | 40 tests across 14 files passed, including a real Windows PTY and actual local HTTP MCP requests. |
| Production build | Passed; Vite reports the large Monaco/workspace chunk. It is loaded when opening a workspace. |
| Windows packaging | `bun run package:windows` produced a runnable Windows x64 folder. |
| Packaged desktop | All 8 Playwright desktop scenarios passed in 22.7 seconds. |
| Native CLI arguments | Claude/Codex npm fixture entrypoints received exact JSON/TOML arguments, including spaces, quotes, parentheses and ampersands. Tokens arrived through process environment; the Electron Node-mode flag did not. Both PTYs closed. |
| MCP lifecycle and bounds | Real HTTP initialization, tool enumeration, explicit tool execution, and session DELETE passed. Cross-origin fetches and redirects are rejected; streamed/declared responses over 4 MiB are refused before parsing. |
| Filesystem safety | Traversal, external junctions, alternate streams, case variants of `.git`, binary and oversized files rejected; stale saves preserve the external version. |
| Process ownership | No test application or fixture CLI process remained after the suite. The pre-existing user application was left running. |

The packaged artifact is under
`release/windows-20261002175923196/TommyBrown-win32-x64/` (ignored, machine-local).
The complete folder is required, including native PTY dependencies. The build is unsigned.

## Desktop scenarios and visual evidence

The packaged suite exercised:

1. Terminal URL clicks, right-pane navigation and browser isolation from Node and preload IPC.
2. Actual CLI fixture execution from a path containing spaces, exact arguments and credentials,
   explicit terminal close, and connector disconnection terminating a dependent terminal.
3. Independent connector cookies, application restart, encrypted token persistence and disconnection cleanup.
4. Space selection, Monaco editing, Markdown preview, retained drafts, save conflicts, and restored document tabs.
5. Downloading the pinned upstream gateway, starting/stopping it, and reopening the app with the installation retained.
6. Component keyboard access and bounded showcase layouts.
7. Real PowerShell input/output, tab switching without process loss, close, and application shutdown.
8. Vault search, preview and save with outbound requests blocked; no remote request was observed.

Inspected the freshly generated terminal, model-access, configured-connector, document,
vault, full native-browser and minimum-window captures. The actual native browser view
was present in the window capture; renderer screenshots alone do not capture that surface.
At the 960-by-640 minimum window, controls remained accessible without pane overlap.
Screenshots and the JSON test report stay in `test-results/`; they may contain fixture
paths and are not public repository artifacts.

## Review disposition

Review was performed sequentially in the main agent under the workspace policy.
There was no independent reviewer. Fixed findings include Windows argument corruption,
unbounded MCP wire responses, unreleased remote MCP sessions, case-insensitive Git
metadata access, React ref mutation during render, and launch/disconnect ordering.
Shutdown stops accepting IPC and waits for already-started operations before closing.

React Doctor reports 68/100 with three errors and four warnings. The three errors label
ordinary async `run(...)` action callbacks in `connector-pane.tsx` as React state updaters;
the actual React updater callbacks are pure. The remaining warnings concern deliberate
sequential initialization after private storage protection, bounded vault reads, ordered
browser restoration, and an array membership check on at most 16 connector selections.
These diagnostics are recorded rather than suppressed or reported as a clean tool run.

## Requirement status

| Requirement | Evidence and remaining limits |
| --- | --- |
| R1 provider login | Real OAuth handoff/wait/cancel was exercised in the gateway checkpoint. Interactive consent and successful login for Claude, Codex and Antigravity remain. |
| R2 cross-CLI models | Profiles and real process argument/environment delivery verified. No live cross-provider inference, streaming or model tool call has been performed. |
| R3 gateway | Actual install/start/stop/restart passed; authenticated account/model discovery still depends on consent. |
| R4 ADE | Spaces, agents, tabs and native terminals exercised. |
| R5 documents | Actual editor/preview/save/conflict and draft switching exercised. |
| R6 browser | Real WebContentsView, terminal links and remote-page isolation exercised. |
| R7/R8 connectors | Registry, isolated web sessions, encrypted credentials and MCP transport/tool execution verified with fixtures. Named-service login and real service data access remain unverified. |
| R9 Obsidian | Local offline vault behavior passed. URI construction is tested; launch of an installed Obsidian app with a real registered vault remains unverified. |
| R10 durability | Spaces, document/browser selection, settings, connector data and sessions restored. Windows package exercised. Live terminal processes/output and unsaved drafts do not survive restart. |

Provider and service consent must be completed by the account owner. No existing CLI
credential files were copied into the gateway, no personal vault was used as a fixture,
and no global CLI configuration was rewritten. These gaps keep the original goal open.
