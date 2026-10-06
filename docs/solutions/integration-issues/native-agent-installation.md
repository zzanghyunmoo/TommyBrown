---
title: Verify and discover coding CLIs installed from the desktop
date: 2026-10-06
module: Agent terminals
problem_type: integration_issue
tags: [electron, cli, installation, windows, macos, subprocess]
---

# Verify and discover coding CLIs installed from the desktop

## Problem

A desktop launched before a CLI installer runs keeps its inherited PATH. A successful
installer exit therefore does not prove that the app can launch the new CLI. Treating
every resolver failure as a missing CLI also risks replacing an existing npm install
whose Node runtime is unavailable.

## Solution

Use the same resolver for installation probes and actual terminal launch. Add the
official native per-user directories as fallbacks, preserving existing PATH precedence.
Give new shell sessions the corresponding paths. Existing terminals retain their
original environments and can be reopened after installation.

`CliNotFoundError` names the missing command. Only a missing requested agent permits
installation; a missing dependency such as Node is a broken existing installation.
Verify a resolved command with `--version` before displaying success. Failed probes
must display their error even when the previous state had a version string.

The main process owns one installation job across renderer view changes. Install IPC
returns immediately; the renderer polls a bounded in-memory snapshot. Fetch only fixed
official HTTPS scripts, reject HTML and oversized responses, and run fixed native
interpreters with argument arrays in a unique temporary directory. Official scripts
perform their payload checksum checks. Scope execution-policy changes to the child
PowerShell process. Do not pass renderer-provided commands or URLs to the installer.

When spawning Windows PowerShell 5.1 from an app started by PowerShell 7, remove the
inherited `PSModulePath` from the installer child's environment (case-insensitively).
Otherwise the official Codex installer can fail to find `Get-FileHash` when verifying
its payload. Let the chosen native interpreter establish its own module paths.

Cancellation and timeouts terminate the process tree. During app shutdown, stop the
installer after the unsaved-document decision, so choosing to keep editing leaves the
service usable. Installation does not sign in or modify TommyBrown model mappings.

## Verification

- Service tests cover existing/broken installs, duplicate starts, false success,
  retry, bounded output, cancellation, shutdown and invalid IDs.
- Native process tests cover nonzero exits, timeouts and descendant termination.
- The Windows resolver fixture proves that an npm wrapper without Node is not
  classified as an absent agent.
- Packaged Electron UI tests cover missing/installing/failed/installed states,
  retry, cancellation and shared state between settings and terminal views.
- An opt-in desktop test installs official CLIs in disposable native CI accounts,
  executes their versions in a new shell and checks discovery after app restart.

See the [implementation contract](../../plans/2026-10-06-agent-cli-installation.md)
and [verification record](../../verification/2026-10-06-agent-cli-installation.md).
