---
title: Share saved connector state across settings and working panes
date: 2026-10-06
module: Desktop settings
problem_type: architecture_pattern
component: development_workflow
severity: medium
applies_when:
  - The same saved connector can be edited from multiple mounted screens
tags: [react, settings, connectors, persistence, tabs]
---

# Share saved connector state across settings and working panes

## Context

Adding global MCP settings exposes the same connector store through both Settings and
the working pane. Independent local lists would leave one screen displaying old tools
or an outdated saved policy after the other screen changes it.

## Guidance

`src/renderer/features/workspace/use-connector-registry.ts` shares the saved connector
snapshot through `useSyncExternalStore`. Add, disconnect and policy-save responses publish
to that snapshot. Each initial read captures a revision and publishes only if no newer
snapshot has arrived. A late read must not overwrite a completed mutation.

Keep form drafts and tool-check results local to each editor. When the saved policy
content changes, update that editor's selected permissions without remounting its
fieldset. Merely receiving a new array instance should not discard an unsaved draft.

Settings and workspace content retain their mounts while hidden. The settings MCP
editor mounts on its first visit and remains mounted afterward. Existing native browser
views still receive explicit visibility updates when leaving the working screen.

Persist navigation separately from domain data. The view schema migrates the old model
page to Settings and remembers the selected settings category. Account credentials,
connector policies and theme choices continue using their existing stores.

## Validation and applicability

The packaged desktop test `tests/desktop/settings.e2e.ts` verifies cross-screen policy
updates, draft retention, a live PowerShell session and restart persistence. Use this
pattern when several screens edit one saved list while retaining separate local drafts.
It is a renderer snapshot, not a replacement for backend authorization or atomic writes.

See the [settings checkpoint](../../verification/2026-10-06-settings-categories.md) and
the [native tab lifetime guidance](../integration-issues/tabbed-native-workspace.md).
