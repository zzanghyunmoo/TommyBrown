# Purpose mappings and terminal clipboard verification

Date: 2026-10-06. Platform: native Windows x64, Electron 44.5.1, real node-pty and xterm 6.
Package: `release/windows-20261006040359897/TommyBrown-win32-x64/TommyBrown.exe`.

## Requested outcomes

- PR #5 merged with a merge commit and PR #6 retargeted to main and squash merged.
  Main reached `5a7423d`; the parent workspace pointer was committed and pushed.
- Added editable task-purpose presets with registered IDs preferred over request
  aliases. Existing IDs, custom names and execution providers are retained.
- Implemented Ctrl+Shift+C/V against the Windows clipboard through authorized IPC.
  Copy skips empty selection; paste adds no Enter, preserves bracket markers and
  multiline Unicode, and drops late reads after blur/disposal/exit. Ctrl+C interrupts.

## Checks

| Check | Result |
| --- | --- |
| `bun run check` | PASS |
| `bun run lint` | PASS, 137 files |
| `bun run test` | PASS, 91 tests in 21 files |
| `bun run package:windows` | PASS |
| Full `bun run test:desktop` with packaged executable | PASS, 13 tests |
| Native clipboard regression before implementation | FAIL as expected: selected output did not replace clipboard |
| Native clipboard after implementation | PASS: copy, empty selection, no implicit Enter, Ctrl+C, Unicode multiline bracket bytes, focus isolation |
| Mapping presets | PASS: account IDs, missing families, repeated apply, preserved choices, limits, case-insensitive aliases |
| Provider routing | PASS: all six directions, native CLI environment/arguments, revision checks and restart restoration |

One initial full desktop run lost a browser fixture input value during workbench
tab switching. The isolated workbench rerun and two subsequent complete suites
passed. No browser production code was changed; the initial intermittent failure
is retained here rather than represented as a first-attempt pass.

The existing Monaco lazy chunk size warning remains. This is a native desktop
verification; no mobile, screen-reader study, or Lighthouse score is claimed.

## Initial account application (superseded below)

Applied the presets through the application UI to the existing local profile, with
a local backup of previous mappings and selections. Retained execution through the
connected OpenAI account and verified every target against its account model catalog:

| Purpose | Claude request | Antigravity request alias | OpenAI execution target |
| --- | --- | --- | --- |
| Deep reasoning | fable | gemini-pro-high | gpt-6-astra |
| Complex coding | opus | gemini-pro | gpt-5.6-terra |
| General coding | sonnet | gemini-flash | gpt-6.1-sol |
| Fast tasks | haiku | gemini-flash-lite | gpt-6-luna |

After reopening, the gateway started automatically and all four rows persisted.
Real installed Claude Code and Antigravity produced successful headless responses through
the connected OpenAI account from an in-app PowerShell session. Claude's explicit
Sonnet selection exercised the general-coding route; Antigravity used the saved
deep-reasoning route. No Google account login or global CLI configuration change.
This does not verify Google inference or benchmark equivalence between families.

## Sequential review and visual evidence

Reviewed correctness, IPC origin/frame authorization, asynchronous clipboard focus
ownership, model identity/duplicate constraints, scope and test coverage. The existing
mapping editor now delegates its provider controls to keep the component bounded.
No blocking findings remain in this change. Reviews were sequential in the main
agent, following workspace policy; no independent reviewer is claimed.

Inspected fresh native captures from the final package:

- `test-results/purpose-mappings-light-native.png`
- `test-results/purpose-mappings-dark-native.png`
- `test-results/model-mappings-native-compact.png`
- `test-results/terminal-clipboard-native.png`

The desktop layout, CJK labels, theme contrast, existing controls, scroll ownership
and terminal colors remain readable. The compact 960x640 mapping table retains its
horizontal scroll and reachable save action. Purpose labels appear in both CLI model
selectors; custom mapping names remain intact. Existing native workbench and theme
tests verify terminal/browser persistence and keyboard focus across sibling surfaces.
Captures and local profile data remain ignored; they are not public repository assets.

## Follow-up: Argon tier and interactive Antigravity

The user corrected the purpose families to Astra/Fable/Argon, Sol/Opus/Pro,
Terra/Sonnet/Flash and Luna/Haiku/Flash-Lite. The existing local rows now use
`gpt-6-astra`, `gpt-6.1-sol`, `gpt-5.6-terra` and `gpt-6-luna`, respectively.
Row IDs and execution providers were retained, with a local settings backup.
Argon is an app request alias; Google Argon access and benchmark equivalence are
not claimed.

The old launch exposed only one opaque model to Antigravity. Registered all mapped
choices as readable provider-scoped aliases and supplied them to `/model`.
AGY 1.2.17 logs an early model-resolution error before gateway authentication;
the interactive fixture established that authentication then reapplies the model
and inference succeeds. Removing `--model` is unsafe: actual-profile testing
reproduced restoration of Pro despite selecting Argon in the app. Explicit selection
is retained. The upstream startup diagnostic remains, without a Google login prompt.

Final package: `release/windows-20261006044702106/TommyBrown-win32-x64/TommyBrown.exe`.

- Typecheck and lint: PASS (138 files).
- `TOMMYBROWN_NATIVE_AGY=1 bun run test`: PASS, 93 tests in 22 files, including
  actual interactive AGY startup and model switching against a local HTTP fixture.
- Final package desktop checks: PASS, 3 affected tests covering all six routes,
  CLI arguments/environment, mapping edits, gateway and selection restoration.
- Real account in the packaged app: Argon/Astra response, four-choice `/model` menu,
  Pro/Sol selection and response: PASS.
- In-app PowerShell `antigravity`: restored gateway and all model choices: PASS.
- Inspected `.local/argon-model-picker.png` and `.local/argon-pro-response.png`:
  selected source, OpenAI target, readable model choices, colors and both replies.

The first live assertion examined raw PTY bytes and failed because ANSI cursor
updates split the response text. The final run asserts the rendered xterm rows.
This is a verification correction; the raw-byte failure is not hidden as a pass.
