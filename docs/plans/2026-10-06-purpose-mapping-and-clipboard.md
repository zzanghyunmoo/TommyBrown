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
| Deep reasoning | Astra | Fable | Gemini 4 Argon |
| Complex coding | Sol | Opus | Pro |
| General coding | Terra | Sonnet | Flash |
| Fast tasks | Luna | Haiku | Flash-Lite |

These are editable task preferences, not benchmark equivalence. Select registered
account IDs when present; otherwise mark names as request aliases, usable only when
routed to an available target. Do not infer Google access from public documentation.
Pro reasoning variants belong to one purpose group. Do not overwrite custom mapping
choices, change routes, or modify global CLI configuration. Apply the user's explicit
correction to their existing four local rows while retaining row IDs and routes.

## Implementation and review

- Add an idempotent purpose preset helper to the existing mapping editor. Show the
  row purpose in both model selectors. Preserve the existing mapping schema.
- Use the authorized desktop IPC boundary for text clipboard operations. Await
  Electron clipboard reads; validate bounded text; keep remote browser IPC denied.
- Handle terminal shortcuts locally, consume both key phases, ignore repeats, copy
  only selections, and call xterm.paste for newline and bracketed-paste behavior.
- Reject late paste delivery after disposal, exit, or a focus change.
- Give Antigravity every mapped choice through its gateway model catalog. Keep the
  selected model explicit so its persisted last choice cannot override the app.
- Sequential review: scope and routing remain within current architecture; no
  provider login or new transport. Native keyboard tests cover the failure surface.

## Acceptance

- Reproduce copy failure before fixing it using actual Windows clipboard and native keys.
- Copy selected output, preserve clipboard on empty selection, paste without added
  Enter, preserve normal Ctrl+C, and retain Unicode/multiline bracketed paste.
- Validate registered-ID selection, absent families, preserved choices, repeated
  presets, row limits, all six routing directions, and restart persistence.
- Verify actual Antigravity interactive startup, `/model` switching and responses,
  including the in-app PowerShell command. Headless responses alone are insufficient.
- Typecheck, lint, unit tests, packaged desktop tests, and inspect native captures.
- Deliver a new PR and Windows build; merging that PR requires its own approval.

## Sources

- [Antigravity models](https://antigravity.google/docs/models)
- [Antigravity CLI model and effort options](https://antigravity.google/docs/cli/headless/)
- [Gemini API models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini 4 Argon announcement](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-argon/)

Argon and Flash-Lite are absent from the reviewed Antigravity model list and remain
request aliases until an execution account advertises their actual model IDs.
