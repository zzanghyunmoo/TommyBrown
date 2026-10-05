# Tabbed workspace and Antigravity checkpoint

Windows x64, Electron 44.5.1. Package: `release/windows-20261005115344003/`.
This supersedes the default layout in the earlier simultaneous-workbench checkpoint.

## Observed behavior

- Both CLI selectors offer Antigravity. The desktop test launches a compiled native
  `agy.exe` fixture through the real PTY and verifies output and process shutdown.
  Claude/Codex argument and connector-secret transport still pass.
- The installed Antigravity executable was separately run with the application's
  generated launch profile against an isolated loopback fixture. It sent authenticated
  requests to `/v1/chat/completions` with the selected `gpt-fixture` model and returned
  the exact response marker. No provider credentials or model credits were used.
- A fresh space has one full-width working area. Terminal, Code/Documents and
  Connectors are keyboard-accessible tabs. Unsaved edits survive switching all three.
- Browser/app actions and connector launches create the right split. Closing it
  restores width; a terminal HTTP link reopens it automatically. Browser and app
  retain separate pages and typed input while switching the visible right-hand tab.
- Native Ctrl+B commands still support terminal splits, focus, zoom, resize, swap,
  help, sidebar and tab operations. Native views hide for modal/resize/settings states.
- Per-space terminal ownership, web/document restoration and no automatic PTY restart
  remain covered. Old three-pane settings migrate once while retaining saved content.

## Verification

- TypeScript, Biome and 54 unit/integration tests passed. They cover routing, unsupported connector
  injection, layout migration, pane geometry and the existing gateway/workspace paths.
- Nine packaged desktop scenarios were exercised. Eight passed in the complete run;
  the hyperlink scenario initially matched the echoed command before its output line
  existed. Waiting for the exact output text fixed the test race. Its targeted rerun
  passed against the same package and also verified reopening a collapsed right split.
- Source desktop coverage passed all eight non-CLI scenarios before final accessibility
  refinements. The initial CLI test exposed the implicit select label including option
  text; explicit accessible names fixed it, and the packaged CLI scenario passed.
- Native composite captures were inspected at normal (1320x880) and minimum (960x640)
  window sizes. Initial state, loaded app, terminal splits and narrow browser content
  were visible; document overflow stayed bounded and no runtime alerts appeared.

Ignored local evidence: `test-results/tabbed-initial-native.png`,
`test-results/workbench-native.png`, `test-results/workbench-minimum-native.png`,
and `test-results/native-browser-composite.png`. These include synthetic terminal
paths and are not published. Renderer-only captures are not evidence of native views.

## Review and limits

Sequential review checked IPC schema expansion, native executable resolution, process-only
gateway credentials, connector rejection, persistent pane identity and migration. No
blocking finding remained. Keyboard users exercised roving tabs, Home/End and the native
prefix. A developer workflow exercised terminal output, document drafts and app inputs;
a narrow-window workflow exercised bounded controls and resize. No human-participant
or screen-reader study was performed.

React Doctor reports 64/100 with three existing ConnectorPane callback false positives
and nine warnings. The added main-tab effects synchronize vault/session selection and
persist it; desktop scenarios exercised those transitions. Existing ordered restoration,
cancelled polling and startup warnings remain. The existing Monaco bundle-size warning
remains. Mobile Lighthouse/SEO scores do not apply to this native Electron surface.

Antigravity per-session MCP injection is unavailable in its current command interface,
so selection is disabled and main rejects it. This checkpoint verifies launch and gateway
transport, not a new live-account inference run or Antigravity's full coding-tool flow.
