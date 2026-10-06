# Service connectors checkpoint

Date: 2026-10-06. Windows x64, Electron 44.5.1, branch `feat/settings-categories`.
This extends the initial [settings checkpoint](2026-10-06-settings-categories.md).

## Delivered behavior

- Settings has Proxy/Models, General/Colors, Connectors and MCP Gateway categories.
- Connectors registers Slack and Atlassian service authorization. The owner completes
  browser consent, inspects tools, saves an allowlist and selects the connection for a CLI.
- Web Apps in the workspace manages website URLs and isolated browser cookies. Web login
  does not authorize agent tools. Both IPC open paths reject tool connections as web apps.
- MCP Gateway manages Context7, bundled Memory and custom Streamable HTTP/Bearer servers.
  Managed service tools use the same gateway and per-terminal lease as these servers.
- New service connections deny all tools until selected. Existing custom MCP policies
  retain their behavior. Manual execution and gateway calls both enforce saved policies.
- Tokens, client secrets, registration, issuer and expiry are encrypted in Electron main.
  The renderer receives status and tool metadata only. Refreshes are serialized per service;
  tool calls do not open consent browsers or retry failed writes automatically.

## Executed checks

- TypeScript and Biome: pass.
- Final full unit suite: 110 pass, one opt-in Antigravity test skipped. The focused
  OAuth suite has eight passing cases, including the Slack confidential-client flow.
- OAuth HTTP fixtures cover PKCE code exchange, issuer persistence, secret non-exposure,
  concurrent refresh, wrong Host/state, callback replay, cancellation during exchange,
  expiry, consent denial, revoked refresh and recovery. Pre-registered Slack credentials
  use `client_secret_post` for exchange and refresh without dynamic registration.
- The authenticated gateway fixture verifies default denial, explicit grant, actual tool
  execution and rejection of a cached tool name after permission withdrawal.
- Migration fixtures verify stable web partition IDs, retained Memory ID/data ownership,
  preserved tokens and allowlists on separate MCP records, idempotence and independent deletion.
- Packaged desktop seven-scenario run passed: `connectors`, `documents`, `mcp-gateway`,
  `mcp-permissions`, `service-connectors`, `settings`, `themes`.
- After the OAuth concurrency review fixes, the final Windows package was built at
  `release/windows-20261006090646631/TommyBrown-win32-x64/`. Packaged `service-connectors`,
  `mcp-permissions` and `settings` were repeated and passed.
- Native captures inspected: `test-results/service-connectors-light.png`,
  `service-connectors-dark.png`, `service-connectors-minimum.png`. The minimum window is
  960x640; category navigation, form fields, tool permissions and scrolling remain usable.
  Images and isolated test profiles remain in ignored local directories.

## Official service checks

The actual Atlassian v2 resource metadata returned 200 and identified the separate
`auth.atlassian.com` authorization server. Its metadata returned 200 and dynamic client
registration returned 201. The application reached the waiting-for-consent state with an
authorization URL on that official origin. The temporary flow was cancelled without
opening an account or obtaining an access token.

Slack's published MCP metadata advertises `client_secret_post` and S256, without dynamic
client registration. The UI therefore requires the owner's registered Slack app details
and displays the exact loopback redirect URI to register.

Actual Slack workspace or Atlassian site consent and authenticated production data/tool
calls were **not** performed. Desktop end-to-end consent and tool calls use a synthetic
HTTP service, including an OS-encrypted profile and restart. This is not production-account
validation. See the official [Slack guide](https://docs.slack.dev/ai/slack-mcp-server/)
and [Atlassian server guide](https://atlassian.github.io/atlassian-mcp-server/).

## Review and operating limits

Sequential review covered correctness, authorization, persistence, migration, API boundaries,
async UI, shutdown and tests. It found and fixed account-replacement/refresh overlap and
stale 401 responses invalidating replacement tokens or hiding pending consent. Cancellation
retains ownership until asynchronous work settles. Native form checks also caught missing
explicit accessible names on select controls. No unresolved blocking findings remain.
No independent agent review or screen-reader study is claimed.

The encrypted registry migrates from version 1 to version 2 on startup, atomically. Old
binaries cannot read the new version. A rollback requires the old encrypted registry from
the same OS user and the matching older app; do not overwrite a newer registry containing
new service authorizations. Web browser partitions and Memory files are not rewritten.

Only one interactive service authorization runs at a time. The loopback callback uses
port 47931; an occupied port produces an actionable failed state and does not stop another
application. Interactive consent expires after ten minutes. OAuth network work is bounded
to 45 seconds, and cancel/disconnect/shutdown abort owned requests.

The existing large editor bundle warning remains. Antigravity 1.2.17's OpenAI model path
still cannot invoke MCP tools, as documented in the [shared gateway checkpoint](2026-10-06-shared-mcp-gateway.md).
The gateway aggregates tools, not MCP prompts/resources. Removing a service deletes its
local authorization; revoking the remote account grant is a service-side action.
