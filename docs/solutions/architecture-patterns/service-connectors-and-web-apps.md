---
title: Separate web sessions from authenticated service tools
date: 2026-10-06
module: Service connectors
problem_type: architecture_pattern
component: authentication
severity: high
applies_when:
  - An embedded service website is mistaken for agent tool access
  - Managed OAuth services share a gateway with custom MCP servers
tags: [oauth, mcp, electron, connectors, pkce, credential-lifetime]
---

# Separate web sessions from authenticated service tools

An embedded Slack or Jira login only establishes a browser session. It does not grant an
agent API access. In TommyBrown, Web Apps own website URLs and cookie partitions; Connectors
own service authorization and tool selection. MCP Gateway delivers allowed tools from both
managed services and custom MCP servers to terminal sessions.

Keep service endpoints in trusted presets and validate registration in main. A renderer
must not attach OAuth credentials to an arbitrary endpoint. `ConnectorStore.list()` strips
both bearer tokens and the entire OAuth object. Persist SDK registration and tokens with
their issuer intact so a refresh token cannot migrate silently between authorization servers.

Discover authorization from the exact resource path. Atlassian's root metadata described an
older flow, while `/v2/mcp` metadata identified `auth.atlassian.com`. A real discovery smoke
check found the missing allowed origin; a same-origin fixture alone did not. Slack uses a
pre-registered confidential client, while Atlassian supports dynamic registration.

Keep authorization code verifiers in memory. Bind the callback to a random one-use state,
exact loopback Host/path, GET and an expiry. Return login-start IPC after opening the browser;
waiting for consent inside the shared IPC queue would block cancellation and other settings.

Serialize refresh by connection and exclude refresh during interactive account replacement.
When a request returns 401, invalidate only the token it actually used. An old response must
not expire a replacement token or overwrite the waiting state of a newer consent flow.
Cancellation keeps flow ownership until pending work settles and checks abort state inside
the store mutation queue, preventing late token writes after disconnect.

New service records begin with `allowedTools: []`. Full tool inspection is available to the
owner, while manual and agent calls both enforce the saved policy at dispatch. See the
[allowlist guidance](../security-issues/mcp-tool-allowlist-dispatch.md).

Use real HTTP fixtures for code exchange, refresh, state/Host rejection, replay, cancellation
and denied consent. Node fetch may replace a supplied Host header; the wrong-Host regression
uses `node:http.request` to send the intended wire request. Verify browser consent and
encrypted restart behavior in packaged Electron, and label synthetic-service evidence
separately from live account validation.

Implementation: `src/main/connectors/oauth.ts`, `store.ts`, `mcp.ts` and the settings panels.
Evidence: [service connector checkpoint](../../verification/2026-10-06-service-connectors.md).
