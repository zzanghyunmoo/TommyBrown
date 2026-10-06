# Categorized settings checkpoint

Date: 2026-10-06. Windows x64, Electron 44.5.1, feature branch `feat/settings-categories`.
MCP work is merged in [PR #8](https://github.com/zzanghyunmoo/TommyBrown/pull/8).
This checkpoint describes the subsequent settings change.

## Observed behavior

- Header and sidebar Settings open Proxy/Models, General/Colors and MCP Gateway tabs.
- A fresh profile can register bundled Memory and save its tool allowlist before opening a space.
- MCP form drafts survive category changes. A saved policy immediately updates the other
  mounted connector screen; terminal connector choices use the same registry.
- General and header theme choices agree. The sidebar can be hidden and restored from
  the header. At native minimum size 960x640 the tab bar, controls and footer remain reachable.
- A real PowerShell process retains its session identity and output across settings/workspace navigation.
- Restart restores the Settings page, last category, Dark theme, hidden sidebar, Memory
  connector and `read_graph` / `search_nodes` allowlist.
- Legacy `models` view state migrates to Settings without losing open document entries.

## Validation

- `bun run check` and `bun run lint`: pass.
- `bun run test`: 100 pass, one opt-in Antigravity native test skipped.
- `bun run package:windows`: pass. Native package under
  `release/windows-20261006080552879/TommyBrown-win32-x64/`.
- Packaged Electron: `settings.e2e.ts`, `connectors.e2e.ts`, `mcp-permissions.e2e.ts`,
  `model-mappings.e2e.ts`, `models.e2e.ts`, `terminal.e2e.ts`, `themes.e2e.ts`,
  `workbench.e2e.ts`: eight scenarios pass. Settings was repeated to retain its native
  captures after the other Playwright run cleared the output directory.
- Native captures inspected: `test-results/settings-proxy-light.png`,
  `test-results/settings-general-light-minimum.png`,
  `test-results/settings-general-dark-minimum.png`,
  `test-results/settings-mcp-light-minimum.png`, `test-results/settings-mcp-dark.png`.
  Tabs, labels, scroll ownership, theme contrast and sidebar recovery were checked.
  Captures and synthetic profiles stay in ignored local directories.

The first full unit run also collected unrelated Node test files downloaded into an
ignored CLI smoke-test profile. All 100 project tests passed in that run, but Vitest
failed the two external suites. `vitest.config.ts` now limits discovery to project
TypeScript unit tests; the full command passes without deleting local profile data.

## Review and limits

Sequential review covered correctness, tests, maintainability, project standards and
async UI lifetime. No unresolved blocking findings. The two theme controls reuse the
same theme store; main-process theme and connector writes already serialize and save
atomically. Registry initial reads check a revision before publication; new subscriptions
cannot replace a saved mutation with an older response. Permission drafts synchronize
when the saved policy content changes, retaining focus and unrelated drafts.

Existing native-browser visibility and sandbox/preload boundaries are retained. The
workbench regression includes native views while navigating Settings. No independent
agent review or screen-reader study is claimed. Rare storage failures and an intentionally
delayed registry response were inspected in code, not injected in the new desktop test.

The existing large editor bundle warning remains. The Antigravity 1.2.17 OpenAI MCP
invocation limitation described in PR #8 is unchanged. This change adds settings
navigation; it does not change model routing or gateway authorization.
