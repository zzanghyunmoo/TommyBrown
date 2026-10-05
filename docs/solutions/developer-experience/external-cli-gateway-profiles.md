---
title: Opt-in external CLI profiles for a connected gateway account
date: 2026-10-05
category: developer-experience
module: Model gateway
problem_type: developer_experience
component: tooling
severity: medium
applies_when:
  - "An account is connected and a user requests external Codex or Claude Code routing."
tags: [codex, claude-code, gateway, credentials, profiles]
---

# Opt-in external CLI profiles for a connected gateway account

## Context

A successful browser login does not establish that a CLI can generate responses
through the gateway. External terminal configuration also needs to coexist with the
user's native CLI login and base configuration.

## Guidance

On Codex CLI 0.157.1, use a named configuration file selected by `--profile`.
Configure a Responses provider with a loopback base URL. Command-backed provider
authentication can read the current local gateway client key at invocation time.
Its `auth.command` must print only the bearer token to stdout and must not be combined
with `env_key`, `experimental_bearer_token`, or `requires_openai_auth`.

On Claude Code 2.1.212, select an explicit settings file with `--settings`. Configure
the loopback `ANTHROPIC_BASE_URL`, a model present in the gateway's live model list,
and `apiKeyHelper` pointing to the local credential helper. Map the default model
tiers to that model when the connected provider does not offer native Claude names.

Keep helper and profile files local. Validate the expected runtime host and key shape,
return no token on failure, and never print the helper output while diagnosing setup.
The helper reads a gateway client key, not the provider account's OAuth credentials.

## Why This Matters

Explicit profiles let the user choose gateway routing without changing the default
CLI provider. Reading the key when needed avoids embedding a reusable secret in the
profile. The gateway must be running, and helper/configuration behavior should be
rechecked when either CLI or the upstream runtime configuration changes.

## When to Apply

Use this after account-owner consent and model discovery, for a user who asks to
configure external CLIs. The desktop's existing
[per-launch profiles](../../../src/main/proxy/profiles.ts) use process-local
environment credentials and do not require these external configuration files.

## Examples

After local profile installation:

```powershell
codex --profile tommybrown
claude --settings "$env:USERPROFILE\.claude\tommybrown.json"
```

Verify an exact response first, then streaming and a harmless synthetic-file tool
call. Record policy-blocked tools separately from inference failures. The
[live checkpoint](../../verification/2026-10-05-openai-cli.md) records successful
responses from both CLIs and Claude streaming/tool execution; Codex tool execution
was blocked by local policy in the isolated verification session.

## Related

- [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- [Claude Code gateway configuration](https://code.claude.com/docs/en/llm-gateway-connect)
- [Windows CLI argument transport](../integration-issues/windows-cli-arguments.md)
