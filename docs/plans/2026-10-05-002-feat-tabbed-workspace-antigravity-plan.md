---
title: Tabbed workspace and Antigravity sessions
date: 2026-10-05
type: feat
status: completed
---

# Tabbed workspace and Antigravity sessions

## Contract

- Antigravity appears in both CLI selectors. Routed launches resolve native `agy`
  and pass the selected model and OpenAI gateway settings to that process only.
- Antigravity's current CLI has no per-invocation MCP configuration flag. Disable
  TommyBrown connector selection for it and reject unsupported requests at main.
- A new workspace starts with one full-width working area. Terminal, code/documents,
  and connectors are tabs. Switching tabs keeps processes and unsaved edits alive.
- Opening a browser link, browser action, app action, or connector web screen opens
  the right split automatically. Browser and app are peer tabs within that split.
  Closing the split restores the working area width without destroying web state.
- Preserve explicit terminal splitting, Herdr commands, isolated native views,
  per-space layouts, and restored web/document state. Migrate the old forced
  three-pane default without discarding content or launching saved PTYs.

## Implementation and review

1. Trace schemas, profile, native resolver, selectors, connector restrictions; add
   focused profile and real process coverage with synthetic credentials.
2. Update DESIGN.md, layout migration, tab selection and pane lifecycle together.
3. Run type/lint/unit checks and actual Electron scenarios, then packaged native
   screenshots at 1320 and 960 pixels. Verify tab preservation, auto-right placement,
   native visibility during overlays, shortcuts, and restart restoration.
4. Record evidence and reusable findings, review sequentially, publish a feature PR.

## Sequential document review

Scope is the two requested changes. Existing account login/global CLI setup is not
rewritten. Native Electron is the acceptance surface; mobile/Lighthouse SEO are not
applicable. Empty, active, error, narrow-window and restored states require checks.
The primary pane stays mounted so closing a split cannot silently discard a draft.
No new dependencies or schema changes to persisted credentials are required.

Implementation and review are recorded in the
[verification checkpoint](../verification/2026-10-05-tabbed-workspace.md).
