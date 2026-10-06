---
title: MCP tool permissions and useful built-in connectors
date: 2026-10-06
type: feat
execution: code
---

# MCP tool permissions and useful connectors

## Product contract

The connector owner can choose all tools, a named allowlist, or no tools. The
saved policy applies to both agent discovery and execution, including an existing
session that cached a previously allowed tool. New tools are excluded from a
named allowlist until selected. Existing connectors retain all-tools behavior.
The connector pane can inspect the full catalog to configure permissions, but its
manual execution control follows the same restriction. Changes apply after save;
already dispatched upstream operations cannot be undone. Clients may need a new
session to refresh their visible tool list.

Add Context7 and Memory presets. Context7 uses its official HTTPS MCP endpoint
with optional bearer authentication. Memory uses the official pinned MCP memory
server, bundled with the app, with one persistent local graph per connector.
Local memory never needs Google login or a globally installed CLI. Removing a
connector retains its graph on disk; do not silently delete remembered user data.

## Implementation units

1. Extend connector records with a backward-compatible tool allowlist, validate
   policy updates in main, filter gateway discovery, and recheck authorization
   immediately before dispatch. Preserve upstream schemas and session scopes.
2. Add the two presets and a narrow managed Memory transport. Serialize Memory
   operations per connector to prevent lost file updates; bound startup/calls,
   honor cancellation and close subprocesses. Bundle the pinned official server.
3. Add accessible permission checkboxes, all/none shortcuts, a save action and
   saved/error feedback, following DESIGN.md. Keep the existing connector form
   and session selector. Memory must appear despite having no remote endpoint.
4. Exercise real Memory writes/reads/restart persistence and actual Context7
   documentation lookup through the gateway. Test stale-name bypass, empty lists,
   invalid policy input, migration, and the packaged desktop controls. Register
   the presets in the user's app and leave a packaged build ready to use.

## Verification and review

Run focused behavioral tests, typecheck, lint, the full unit suite, and affected
packaged desktop tests. Inspect light/dark permission states in the native app.
Use synthetic Memory records only; don't copy private project data to Context7.
Verify both list filtering and blocked calls reaching zero upstream invocations.
Review sequentially under workspace policy for authorization races, persistence,
subprocess lifecycle, scope and usability. No independent-agent review is claimed.

## Review decisions

- A filter on tools/list alone is insufficient; every call checks current policy.
- Persist allowlists, not denylists, so upstream additions stay excluded.
- Share one Memory operation queue between manual and gateway calls.
- Keep all-tools as an explicit compatibility mode and show that future tools
  are included. Empty allowlists mean deny all, never fallback to all tools.
- Keep the existing Antigravity OpenAI tool-transport limitation visible. This
  work does not claim to fix the third-party CLI's missing tool-call support.

## References

- [Context7 clients](https://context7.com/docs/resources/all-clients)
- [Official Memory server](https://github.com/modelcontextprotocol/servers/tree/main/src/memory)
- [Session gateway pattern](../solutions/architecture-patterns/session-scoped-mcp-gateway.md)
