---
title: Shared MCP gateway for coding terminals
date: 2026-10-06
status: blocked-on-antigravity-tool-transport
---

# Shared MCP gateway

TommyBrown will expose the tools from the connectors selected for a terminal
through one `tommybrown` MCP server. Claude Code, Codex and Antigravity receive
session configuration automatically, including when invoked inside the app's
PowerShell. Existing global CLI configuration remains user owned.

## Contract

- Start a loopback Streamable HTTP MCP gateway with the desktop app; stop it on exit.
- Each terminal receives an unpredictable, revocable credential scoped to its
  selected connectors. Upstream connector credentials stay in Electron main.
- Forward tool schemas, annotations and results, including structured content and
  tool errors. Namespace names deterministically to avoid collisions. Never retry
  a tool execution automatically. Resources, prompts and upstream OAuth are outside
  this change; the existing HTTP endpoint and bearer-token connector form remains.
- Close access on process exit, launch failure and connector disconnection. Bound
  requests and upstream responses, reject browser origins and unexpected hosts.
- Use launch-only Codex overrides, a Claude MCP configuration file and an
  Antigravity plugin discovered via `--add-dir`. App-owned temporary configuration
  may contain only the short-lived gateway credential; protect and clean it.
- Show gateway availability and allow the same connector selection for all CLIs.
- Preserve model routing, terminal clipboard shortcuts and saved user settings.

## Implementation and verification

1. Extend the existing MCP client with raw tool catalog/result operations and
   cancellation. Add the authenticated, session-scoped gateway and HTTP tests.
2. Build per-session CLI profiles and wire their disposal into terminal lifecycle.
   Include PowerShell wrappers for the three installed CLIs.
3. Update connector selection and gateway status, then verify desktop behavior.
4. Run check, lint, unit and affected desktop tests. Prove actual tool execution
   with a nonce-producing local upstream through each installed CLI, using the
   connected account where required. Package Windows and record exact results.

## Investigation and review

Sequential main-thread review follows workspace policy. The main security boundary
is the terminal credential, not the HTTP port. No upstream token or endpoint is
sent to a child CLI. A connector unavailable at call time produces an explicit
error; another connector is never substituted. Tool permissions remain controlled
by each CLI, with no blanket approval bypass.

Native Antigravity 1.2.17 discovers a plugin under an additional workspace directory
and authenticates to MCP using literal HTTP headers. Environment interpolation in
its MCP headers was not supported in the local probe. Its current OpenAI model
transport omitted callable tools in the first probe; tool-list discovery alone is
not acceptance. Resolve this before claiming three-CLI execution support.

PR #7 was merged after final confirmation. Feature work is based on its merged main.
The gateway and CLI configuration paths are implemented and tested. Claude and Codex
performed actual MCP calls; Antigravity's OpenAI execution criterion remains blocked.
See [verification](../verification/2026-10-06-shared-mcp-gateway.md).
