# MCP tool permissions and useful connectors

Verified 2026-10-06 on Windows x64 with Electron 44.5.1 and the official Memory
server 2026.8.31. Package:
`release/windows-20261006072033258/TommyBrown-win32-x64/TommyBrown.exe`.

## Behavior

Connector permissions persist an explicit all-tools mode (`null`) or a list of
allowed original tool names. An empty list denies everything. Legacy records
without a policy retain all-tools behavior. Both the gateway catalog and the
shared manual/gateway call path enforce the current saved policy. Authorization
is rechecked after asynchronous discovery, immediately before execution.

The connector pane exposes checkboxes, all/none actions, explicit save, saved vs
unsaved feedback and disabled manual execution for blocked tools. Existing CLI
sessions cannot bypass a restriction by retaining an old namespaced tool name.
Previously dispatched upstream work cannot be rolled back. A CLI may need a new
session to refresh its displayed catalog.

Context7 is a remote HTTP preset. Memory runs a bundled official stdio server with
an app-owned absolute storage path per connector. Its processes are hidden, bounded
and closed after each operation. Manual and gateway operations share a serialized
queue for each graph, preventing read/modify/write races. No global CLI settings
or installations are changed. Memory graph files are local, access restricted, and
retained when a connector is disconnected; graph contents are not OS-encrypted.

## Observed checks

| Check | Result |
| --- | --- |
| `bun run check` / `bun run lint` | Passed |
| Full unit suite | 99 passed, one existing opt-in native Antigravity test skipped |
| Permission regression | Initially failed because `setTools` did not exist; passed after implementation |
| Cached name after deny-all | Rejected; fixture upstream received zero calls |
| Legacy, empty and malformed policies | Compatibility preserved; explicit deny-all persisted; malformed input rejected |
| Official Memory server | Concurrent synthetic writes both survived; reads after reopening succeeded |
| Context7 through the gateway | `resolve-library-id` found Zod; `query-docs` returned `safeParse` documentation |
| Memory through the gateway | `create_entities`, `search_nodes` and `read_graph` returned actual persisted data |
| Native Claude Code with connected OpenAI account | Called Memory `search_nodes` and Context7 `query-docs`; returned a nonce absent from its prompt |
| Native Codex with connected OpenAI account | Called the same two tools; returned its own nonce absent from its prompt |
| Packaged connector and gateway regressions | Both existing scenarios passed |
| Packaged permission scenario | UI registration, real write/read, existing-session rejection, saved allowlist and app restart all passed |
| Visual checks | Native light/dark permission captures inspected; checkboxes, save status and bounded scrolling visible |

Three affected desktop scenarios passed across focused runs. Two initial assertions
in the new UI test used an imprecise label locator and `bright` instead of the
existing `light` theme value; both were corrected. The production behavior exercised
before those assertions was successful. The extracted HTTP test fixture was checked
again with all five gateway tests passing.

Reproduce the live MCP checks after `bun run build` with
`bun run scripts/mcp-smoke.ts`. This uses anonymous Context7 access and isolated
synthetic Memory data. Test captures stay ignored under
`test-results/mcp-permissions-light.png` and `test-results/mcp-permissions-dark.png`.
Native CLI probes are local-only artifacts and do not expose account credentials.

## Installed local configuration

Context7 and Memory were added to the actual application profile and checked.
Context7 allows its two current documentation tools. Memory allows
`create_entities`, `create_relations`, `add_observations`, `read_graph`,
`search_nodes`, and `open_nodes`; its three `delete_*` tools start blocked.
Both are explicit allowlists, editable in the connector pane. Existing connector
policies were preserved. The new package was launched with the saved model proxy
and MCP gateway active. Test memories were written only to isolated test profiles.

## Review and limits

Sequential review covered stale catalogs, authorization before dispatch, policy
migration, renderer credential isolation, hidden subprocess lifecycle, serialization,
and UI error/saved states. No independent-agent review was performed under the
workspace's sequential policy. Existing application bootstrap was changed only
to wire the shared MCP instance; the test fixture was split from its scenarios.

Antigravity 1.2.17's pre-existing OpenAI tool-transport limitation remains: MCP
discovery is available, actual model-driven calls on that route remain blocked.
No claim of successful Antigravity invocation is made. General user-defined stdio
commands, upstream OAuth, resources and prompts are outside this addition. The
pre-existing large renderer chunk build warning is unchanged.

References: [Context7 clients](https://context7.com/docs/resources/all-clients),
[official Memory server](https://github.com/modelcontextprotocol/servers/tree/main/src/memory).
