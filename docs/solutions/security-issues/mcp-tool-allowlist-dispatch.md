---
module: MCP gateway
date: 2026-10-06
problem_type: security_issue
component: authentication
severity: high
symptoms:
  - Selecting a connector exposed all of its tools
  - A cached gateway catalog could outlive a permission change
root_cause: missing_permission
resolution_type: code_fix
tags: [mcp, authorization, allowlist, stale-cache, connectors]
---

# Enforce MCP allowlists at dispatch

Filtering `tools/list` does not authorize `tools/call`. A CLI can cache a tool's
namespaced name and continue sending it after the owner changes its permissions.
The gateway intentionally caches name-to-connector mappings, so the cached entry
must never act as the permission decision.

`src/main/connectors/store.ts` persists `allowedTools`: `null` means explicitly
allow all, an array is a named allowlist, and `[]` denies every tool. Missing legacy
fields default to `null`; never treat an empty array as the default. Named policies
exclude future upstream tools until the owner selects them.

`src/main/connectors/mcp.ts` filters the agent catalog but keeps the full inspection
catalog available to the owner. Its shared call path checks the current policy
before connecting and again after asynchronous tool discovery, directly before
`client.callTool`. The same path is used by manual execution and gateway forwarding,
so disabling a renderer button is only feedback, not the security boundary.

The terminal's connector scope remains a separate requirement. A saved allowlist
cannot grant access to a connector that was never selected for that terminal.
Saving restrictions does not undo an upstream operation already dispatched; clients
may also need a fresh session to refresh their visible tool catalog.

## Verification

`tests/connectors/gateway.test.ts` lists a tool, saves deny-all, then calls the old
name through the existing authenticated session. The call must fail and the fixture
must record zero upstream calls. After an explicit grant, listing and execution
work again. `tests/connectors/memory.test.ts` checks persistence, legacy migration,
malformed policies and actual Memory calls. The packaged
`tests/desktop/mcp-permissions.e2e.ts` drives the checkboxes and verifies a cached
delete call is rejected while the remembered record survives app restart.

See the [session gateway pattern](../architecture-patterns/session-scoped-mcp-gateway.md)
and [verification checkpoint](../../verification/2026-10-06-mcp-tool-permissions.md).
