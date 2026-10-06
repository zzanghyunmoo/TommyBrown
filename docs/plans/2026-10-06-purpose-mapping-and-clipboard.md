---
title: Purpose model mappings and terminal clipboard
date: 2026-10-06
type: fix
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
---

# Contract

PRs #5 and #6 are merged. This change groups models by user-selected purpose and
fixes Ctrl+Shift+C/V inside the desktop terminal. Keep ordinary Ctrl+C as interrupt.

| Purpose | OpenAI family | Claude shortcut | Gemini family |
| --- | --- | --- | --- |
| Deep reasoning | Astra | Fable | Pro High |
| Complex coding | Terra | Opus | Pro / low or medium variant |
| General coding | Sol | Sonnet | Flash |
| Fast tasks | Luna | Haiku | Flash-Lite |

These are editable task preferences, not benchmark equivalence. Select registered
account IDs when present; otherwise mark names as request aliases, usable only when
routed to an available target. Do not infer Google access from public documentation.
Do not collapse Pro reasoning variants into a duplicate model ID, overwrite custom
mapping choices, change routes, or modify global CLI configuration.

## Implementation and review

- Add an idempotent purpose preset helper to the existing mapping editor. Show the
  row purpose in both model selectors. Preserve the existing mapping schema.
- Use the authorized desktop IPC boundary for text clipboard operations. Await
  Electron clipboard reads; validate bounded text; keep remote browser IPC denied.
- Handle terminal shortcuts locally, consume both key phases, ignore repeats, copy
  only selections, and call xterm.paste for newline and bracketed-paste behavior.
- Reject late paste delivery after disposal, exit, or a focus change.
- Sequential review: scope and routing remain within current architecture; no
  provider login or new transport. Native keyboard tests cover the failure surface.

## Acceptance

- Reproduce copy failure before fixing it using actual Windows clipboard and native keys.
- Copy selected output, preserve clipboard on empty selection, paste without added
  Enter, preserve normal Ctrl+C, and retain Unicode/multiline bracketed paste.
- Validate registered-ID selection, absent families, preserved choices, repeated
  presets, row limits, all six routing directions, and restart persistence.
- Typecheck, lint, unit tests, packaged desktop tests, and inspect native captures.
- Deliver a new PR and Windows build; merging that PR requires its own approval.

## Sources

- [Antigravity models](https://antigravity.google/docs/models)
- [Antigravity CLI model and effort options](https://antigravity.google/docs/cli/headless/)
- [Gemini API models](https://ai.google.dev/gemini-api/docs/models)

Flash-Lite is a Gemini family but is absent from the reviewed Antigravity model list.
