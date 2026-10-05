# Simultaneous workbench verification

Verified on Windows x64 with Electron 44.5.1 on 2026-10-05, against
`feat/simultaneous-workbench` based on `9952732`.

## Delivered behavior

The default workspace shows terminal, browser, and application panes together.
The app pane covers localhost web apps and connected web services; arbitrary native
Windows window embedding is outside this implementation. Code/documents and
connectors remain available inside the app/tool pane.

Herdr's Ctrl+B bindings are used for the supported pane, tab, workspace, and session
actions listed in [README](../../README.md#workbench-shortcuts). This does not claim
Herdr's detached server, worktree features, or terminal copy-mode editor.

## Checks and evidence

| Check | Result |
| --- | --- |
| `bun run check` | Pass |
| `bun run lint` | Pass |
| `bun run test` | 51 tests across 16 files passed |
| `bun run build` | Pass; existing Monaco bundle-size warning remains |
| Source desktop suite | 9 passed; compact-pane and modifier follow-up scenario also passed after the final fixes |
| Final packaged desktop suite | 9 passed in 31.1 seconds |
| Native visual inspection | Initial/compact-fix comparison and final-package reinspection at default and minimum size |
| Public content scan | No private user paths, recognized token prefixes, or private key markers in source, tests, or documentation |

The final package is
`release/windows-20261005111016007/TommyBrown-win32-x64/TommyBrown.exe`.
Keep its companion files together. Packaged file SHA-256 values:

| File inside resources/app | SHA-256 |
| --- | --- |
| dist/main/index.cjs | aa174f571ffbcf884256f4c1031e9e20e2229571beb1702cb9e115584ddfa56f |
| dist/renderer/index.html | 6f24aaed7b87462381d532b5d818309c8cdac9325a75dbd7cc55850bd5aa9795 |

Native captures remain local and ignored because terminal prompts contain personal
paths: `test-results/workbench-native.png` and
`test-results/workbench-minimum-native.png`. The final structured desktop report is
`test-results/desktop-report.json`. Renderer-only captures are not composition proof.

## Requirements observed

| Requirement | Actual verification |
| --- | --- |
| R1: simultaneous surfaces | A real PowerShell PTY and two separately rendered, interactive WebContentsViews coexist. Input and button state remain independent. |
| R2: pane operations | Native prefix focus, split, zoom, swap, close, keyboard resize, and pointer resize; closing one space's pane preserves another space's exact session IDs. |
| R3: Herdr keys | Prefix unit tests plus native key dispatch from renderer and remote content; tab next/previous/close, help, sidebar, and resize were exercised. |
| R4: input ownership | Real shell commands and page text input; remote pages lack Node, terminal, and workbench bridges; settings and modal overlays hide native views. |
| R5: state retention | Existing PTY output survives edits and space switching; another space's zoom does not hide the restored layout. Restart restores pane ratios and separate browser/app URLs without starting new PTYs. |
| R6: regression safety | Existing browser/link, CLI shim, connector/session, document/conflict, gateway, component, PTY cleanup, and offline vault scenarios pass in the final package. |

Fixtures use isolated app data and loopback servers. Gateway tests allocate an
ephemeral port under the existing test flag; ordinary launches still use 8317.
No live provider consent or model-credit spending was needed for this layout change.

## Review and fixes

Sequential in-thread diff review covered layout ownership, native-view bounds,
keyboard consumption, IPC validation, document preservation, and test assertions,
as required by the workspace's sequential-agent policy. No independent subagent or
cross-model approval is claimed. No actionable defect remained in the reviewed scope.

Review fixes made terminal closure space-specific, prevented persisted panes from
automatically launching duplicate PTYs, reset zoom on space changes, rejected
malformed persisted pane identities, and applied the eight-pane cap to restoration.
The simplification pass replaced one indirect document-tab lookup with `indexOf`;
it found no further behavior-preserving reuse or efficiency change worth adding.

Visual review caught a failure that the first green desktop suite did not cover:
at 960 by 640 with four panes, fixed toolbars consumed the body and xterm could
request a one-row PTY. Compact controls and grid bounds matching the IPC contract
fix this. The new body-height assertion failed against the prior package (height 0)
and passed in the final package; terminal and web bodies now remain above 24px.
Small panes still intentionally scroll, with zoom available for focused work.

The final input review also found that a physical Shift keydown could cancel the
pending prefix before an uppercase action. Modifier-only events now retain the
mode. The native test includes Shift down/action/Shift up; it failed to open help
against the previous package and passes help, tab closing, and swapping in the
delivered build. A focused unit regression also covers re-pressing Control.

## Diagnostic limits

React Doctor reports 65/100 (3 errors, 8 warnings), so it is not a clean diagnostic
gate. The three errors identify existing connector `run(() => ...)` callbacks as
state updaters; `run` is an async action wrapper, not a React setter. Warnings cover
intentional ordered tab restoration, canceled async polling, persisted app-mode
effects, existing startup/vault sequencing, lookup cost, and browser-pane complexity.
No diagnostic suppression was added. The full lint and type checks pass.

Desktop composition, keyboard behavior, and screenshots are the relevant evidence;
no Lighthouse/SEO score or native Windows application embedding is claimed.

## Operational validation

On adoption, the maintainer should watch the first working session for blank panes,
lost focus, unexpected session exits, or `terminal:resize` / `browser:bounds` errors.
Healthy behavior is concurrent input and retained PTYs through pane operations.
If these regress, stop new work, save documents, and reopen the previous package;
preserve application data for diagnosis. No shared service deployment is involved.
