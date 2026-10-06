---
title: Install missing coding agents from TommyBrown
date: 2026-10-06
artifact_readiness: implementation-ready
execution: code
---

# Install missing coding agents

## Goal and scope

Users can discover and install missing Codex, Claude Code, and Antigravity CLIs
from settings and the terminal selector on Windows and macOS. Installation is an
explicit user action, using each vendor's native user-level installer, without
requiring Node or a package manager. Existing installations take precedence.
Installation does not sign in, launch a paid request, or change model routing.
Updating, uninstalling, and installing automatically at startup are out of scope.

## Decisions and implementation units

1. `src/shared/agents.ts` and `src/main/agents/`: fixed provider IDs and official
   installer URLs only; no renderer-supplied command, URL, path or environment.
   Download to a unique temporary directory with size/time bounds, run the script
   with a fixed native interpreter, and retain bounded progress/error output.
   One installation at a time; cancellation and app shutdown terminate the owned
   process tree. Start IPC returns promptly while the main process owns the job.
   Verify success by the same resolver as terminal launch and a real `--version`.
   Missing, installed, checking, installing, failed and unsupported states remain
   distinguishable. A broken existing installation is reported without replacing it.
2. Extend `src/main/terminal/resolve-cli.ts` with the official Windows per-user
   native directories; preserve PATH precedence and npm wrapper handling. New
   shell sessions receive these paths even before the app's inherited PATH changes.
   Existing terminal sessions can be reopened to pick up a newly installed tool.
3. Add a coding-agent panel to general settings and a compact installation action
   beside a missing terminal CLI. Reuse current panels, buttons and theme tokens.
   State survives view changes because main owns it. Show progress, cancellation,
   errors, retry and refresh; disclose that official installers may update the
   user's PATH/shell integration. Authentication remains in existing account flows.

## Verification contract

- `tests/agents/service.test.ts`: failure-first coverage for duplicate starts,
  existing/broken installs, failed verification, retry, cancel, shutdown, output
  bounds, and rejected unknown IDs. Mock only external install/probe dependencies.
- `tests/agents/process.test.ts`: real child process output, nonzero exit, timeout,
  cancellation and process-tree cleanup. No real user's CLI is overwritten.
- `tests/desktop/agent-installation.e2e.ts`: Electron UI missing -> progress ->
  installed, error/retry and view transitions with controlled IPC fixtures; reject
  invalid install input through the actual main bridge.
- `tests/desktop/agent-installation-live.e2e.ts`: opt-in disposable native CI accounts,
  official installers for all three CLIs, version verification, immediate real
  terminal launch, and restart discovery on Windows x64/macOS ARM64/macOS x64.
- Typecheck, Biome, unit suite, build, desktop UI and native screenshots. Record
  actual OS results and upstream network failures honestly in docs/verification.

## Review and landing

Plan review: explicitly keep installer work outside the shutdown IPC wait; use
fixed trusted interpreters and isolated cwd; bound logs; keep missing distinct from
broken so an existing user's CLI is not silently overwritten. Native scripts own
their payload checksum verification. Inspect their behavior, including shell setup.

Stack the feature PR on `fix/release-profile-isolation` (PR #11), preserving the
already released empty-profile fix. Do not merge either PR without authorization.

## Sources and existing patterns

- [Codex CLI installation](https://learn.chatgpt.com/docs/codex/cli)
- [Claude native setup](https://code.claude.com/docs/en/setup)
- [Antigravity installation](https://www.antigravity.google/docs/cli/install/)
- `src/main/index.ts`: trusted IPC sender boundary and shutdown ownership.
- `docs/solutions/integration-issues/windows-cli-arguments.md`: direct executable
  resolution, preserving argument arrays instead of executing arbitrary wrappers.
- `docs/solutions/integration-issues/release-profile-isolation.md`: separate stable
  and development profiles; do not migrate or seed personal state during install.
