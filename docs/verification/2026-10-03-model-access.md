# Model access checkpoint - 2026-10-03

Windows x64, Node.js 24.11.1, Bun 1.3.14, Electron 44.5.1, CLIProxyAPI 8.0.10.
This is an implementation checkpoint, not completion of the product contract.
This historical gateway-only checkpoint is superseded by the
[desktop workspace checkpoint](2026-10-03-desktop-workspace.md).

| Check | Observed result |
| --- | --- |
| Strict TypeScript | `bun run check` passed. |
| Formatting and lint | `biome check --write .` completed without diagnostics. |
| Behavior tests | `bun run test`: 24 tests across 7 files passed. |
| Production build | `bun run build` passed. |
| Native desktop | `bun run test:desktop`: 2 tests passed, including real download/start/stop/restart. |
| React analysis | `bun run doctor:react`: 100/100, no issues reported. |
| Actual upstream engine | `bun run smoke:proxy` verified archive, authenticated readiness, unauthorized 401 responses, and OAuth URL/wait/cancel for Claude, Codex, and Antigravity. |
| Visual inspection | Model-access window and component showcase inspected. Footer visibility, keyboard focus, disabled states, and narrow showcase layouts exercised. |

Native desktop scenarios use an isolated account directory with zero accounts and
zero available models. Restart preserves the encrypted application-key file and
verified engine installation. Windows ACL verification confirms the current user's
access and inheritance into newly created credential files, including repeated setup.

The login-session regression tests use a mocked gateway: snapshots retain pending
consent across refresh, temporary polling failure remains cancellable, expiry clears
the session, successful consent refreshes accounts, and gateway exit permits retry.
These tests do not establish live provider login success.

## Remaining acceptance

| Requirement | State |
| --- | --- |
| R1 provider login | Browser handoff and cancellation verified; interactive consent for all three providers remains. |
| R2 shared models | Claude/Codex launch profiles and shell quoting tested; live inference, streaming, and tool calls remain. |
| R3 gateway | Installation, authentication, readiness, conflict, failure, stop, and restart tested; account persistence after live consent remains. |
| R4-R9 ADE and connectors | Not yet implemented at this checkpoint. |
| R10 durable application | Engine/application keys survive restart; workspace restoration and a packaged Windows build remain. |

## Review

Reviewed sequentially under workspace policy: process ownership, archive integrity,
loopback authentication, narrow IPC origin checks, renderer secret exposure, OAuth
lifecycle, Windows filesystem permissions, CLI quoting, and actual desktop behavior.
Fixed a login-state recovery gap, serialised management IPC, and corrected repeated
Windows ACL setup. No independent subagent review was performed.

Residual limits: Windows x64 is the tested runtime; Windows arm64 downloads are pinned
but not exercised. Provider token files remain plaintext inside the restricted private
directory because the upstream sidecar reads them. Forced termination can leave the
runtime configuration there; normal shutdown removes it. No signed installer exists yet.

Screenshots are local ignored artifacts in `test-results`; no personal account content
or credentials are included in this checkpoint's repository files.
