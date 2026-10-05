---
title: Retain native workspace state while changing pane visibility
date: 2026-10-05
module: Desktop workspace
problem_type: integration_issue
tags: [electron, tabs, migration, antigravity, pty]
---

# Retain native workspace state while changing pane visibility

Changing a permanently split workspace to tabs changes visibility and geometry, not
the lifetime of its content. Keep the primary terminal/document host and both browser
groups mounted. A hidden native WebContentsView needs an explicit hidden bounds update;
DOM `hidden` alone cannot hide native child views. Keep bounds invalidation for position
changes and hide native surfaces while overlays or splitter gestures own input.

Store a layout version separately from content. Migrate old forced support leaves once,
retain explicit terminal splits and saved web/document entries, and persist the new
version on the next save. Otherwise each read can erase a support pane the user reopened.
Keep a primary working host even when a pane-close command targets its active tab, so
unsaved documents still follow their existing close confirmation.

For Antigravity, provider login support does not imply CLI launch support. Update the
request schemas, both selectors, native `agy` resolution and launch profile together.
The actual key variable is `AGY_LLM_GATEWAY_API_KEY`; use an OpenAI wire protocol,
`/v1` base URL, explicit model and process-local credentials. Verify with a real native
process and an isolated HTTP fixture. Do not send Claude's MCP flags to Antigravity.

Terminal hyperlink tests must wait for an exact output row. A substring can match the
echoed command first; coordinates captured then point at plain command text after the
PTY output arrives. This is a synchronization failure, not proof that link handling broke.

See the [checkpoint](../../verification/2026-10-05-tabbed-workspace.md) for observed
desktop, migration, keyboard and gateway results and their limits.
