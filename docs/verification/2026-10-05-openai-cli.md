# OpenAI account and external CLI checkpoint - 2026-10-05

Windows x64, CLIProxyAPI 8.0.10, Codex CLI 0.157.1, Claude Code 2.1.212.
This extends the [desktop checkpoint](2026-10-03-desktop-workspace.md) with live
requests through the existing user gateway. It is not a full product acceptance.

## Observed results

| Check | Result |
| --- | --- |
| Connected account | The owner reported successful OpenAI login. One account file was present, and the authenticated model-list endpoint returned OpenAI models. |
| Gateway | Existing loopback gateway on port 8317 remained running. No account token was copied into either CLI. |
| Local credential helper | Returned a valid gateway client key from runtime configuration. The helper output was captured in memory, never printed in the verification report. |
| Codex | The named `tommybrown` profile selected the Responses endpoint and `gpt-6-astra`. An ephemeral invocation exited 0 and returned the requested synthetic marker exactly. |
| Claude Code | Explicit TommyBrown settings selected the same OpenAI model through the Anthropic-compatible endpoint. The invocation exited 0 with a successful result and the exact contents of a synthetic file. |
| Claude streaming and tool use | Captured 68 stream events, including 23 text deltas, one `Read` invocation, and its successful tool result. |
| Codex tool limit | A separate file-read attempt reached the model, but its PowerShell command was rejected by local execution policy. This does not establish successful Codex tool execution; the policy was not changed. |
| Antigravity CLI | Google's official Windows installer installed `agy` 1.2.17. Version/help commands passed and the user PATH contains its installation directory. Existing CLI aliases were preserved. Authentication and inference with `agy` were not attempted. |

The model was already selected in the user's Codex configuration and was present in
the live gateway model list. It was not selected from an assumed model catalogue.

## Local setup and use

Two opt-in, machine-local configuration files were added. Existing base settings and
CLI login stores were preserved. Both profiles obtain only the gateway client key from
a local Node.js helper; neither configuration embeds a key or provider OAuth token.
Start the TommyBrown gateway before launching either profile:

```powershell
codex --profile tommybrown
claude --settings "$env:USERPROFILE\.claude\tommybrown.json"
```

These commands apply to the configured machine. The profiles and helper are outside
version control; cloning this repository does not install them. The application also
provides per-session routing and a generated external-terminal command.

Open a new terminal to pick up the Antigravity PATH change, then run `agy`.
Its first authentication remains an account-owner action.

## Verification scope

The live checks used an isolated synthetic directory, no personal project or vault.
Codex used `exec --ignore-user-config --profile tommybrown`, strict configuration,
an ephemeral session, read-only sandboxing and no automatic approval. Claude used
`--bare`, the explicit settings file, disabled session persistence, and only its
read-only `Read` tool. Base-config plugins and interactive UI behavior were not tested
by these external-CLI invocations. Raw local logs contain fixture paths and were not
added to this public repository.

The 40 behavior tests and 8 packaged desktop scenarios recorded on 2026-10-03 remain
the implementation evidence; this change only updates documentation and local setup.
Other provider consent, real named-service accounts, and installed Obsidian launch
remain open. Installing Antigravity CLI does not verify Antigravity OAuth in TommyBrown.

## References

- [Codex configuration](https://learn.chatgpt.com/docs/config-file/config-reference)
- [Claude Code gateway configuration](https://code.claude.com/docs/en/llm-gateway-connect)
- [Antigravity CLI installation](https://www.antigravity.google/docs/cli/install/)
