---
title: Scope shared MCP access to the terminal lifetime
date: 2026-10-06
category: architecture-patterns
module: MCP gateway and terminal sessions
problem_type: architecture_pattern
component: authentication
severity: high
applies_when:
  - "Several local coding CLIs must use selected connectors without global configuration edits."
tags: [mcp, gateway, windows, terminal, credentials, lifecycle]
---

# Scope shared MCP access to the terminal lifetime

## Context

Direct connector injection gave each CLI an upstream endpoint and credential, while
native Antigravity did not accept the same launch configuration. A common gateway
needs an explicit permission scope; one app-wide token would let any terminal call
every saved connector.

## Guidance

[McpGateway](../../../src/main/connectors/gateway.ts) issues an unpredictable bearer
credential per terminal and stores its selected connector IDs in main memory. It
binds to loopback, checks Host and Origin, bounds requests, namespaces tool names,
and forwards the upstream schema and result. It never retries a tool execution.

[ConnectorProfiles](../../../src/main/connectors/profiles.ts) creates a protected,
temporary configuration directory. Claude receives an MCP file path, Codex receives
URL and token-environment overrides, and Antigravity receives an added workspace
containing a plugin. Only the local session credential reaches those files; upstream
credentials remain in the main-process connector client. Use the existing
[Windows directory ACL helper](../security-issues/windows-private-directory-restart.md).

[TerminalService](../../../src/main/terminal/service.ts) owns the credential lifetime.
Revoke first on closure, terminate the process, then await file cleanup. Also revoke
on spontaneous process exit and launch failure. A cleanup error must not preserve
access or prevent process termination. Old credentials become invalid on restart,
even when a crash left temporary files behind.

## Why this matters

The endpoint can be shared while permissions remain separate. A terminal that selected
one connector cannot invoke another terminal's tools. Schema/result preservation keeps
the gateway compatible with normal MCP clients and each CLI's approval behavior.

Discovery and execution require separate evidence. Antigravity 1.2.17 initialized
this MCP server and listed its tools, but its OpenAI transport did not expose or
execute tool calls. This integration is not complete for that model route. See the
[checkpoint](../../verification/2026-10-06-shared-mcp-gateway.md) for the exact boundary.

## When to apply and verify

Use this pattern when the desktop owns connector credentials and terminal processes.
For launch arguments, retain the native process transport described in
[Windows CLI arguments](../integration-issues/windows-cli-arguments.md). File-based
MCP configuration also avoids PowerShell 5.1 stripping embedded JSON quotes.

The [HTTP tests](../../../tests/connectors/gateway.test.ts) exercise isolation,
revocation and cancellation. The [desktop test](../../../tests/desktop/mcp-gateway.e2e.ts)
checks actual shell functions, disconnection and restart. An actual model test must
observe upstream `tools/call` and a freshly generated result that was not in its prompt.
