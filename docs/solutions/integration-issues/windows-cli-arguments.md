---
title: Preserve Windows CLI arguments through direct PTY execution
date: 2026-10-03
category: integration-issues
module: Agent terminals
problem_type: integration_issue
component: tooling
symptoms:
  - "Claude MCP JSON loses quotation marks when passed through Windows PowerShell 5.1."
  - "A global cmd wrapper truncates an argument at an ampersand."
root_cause: wrong_api
resolution_type: code_fix
severity: high
tags: [windows, terminal, node-pty, cli, mcp, quoting]
---

# Preserve Windows CLI arguments through direct PTY execution

## Problem

The initial terminal launch joined CLI arguments into a PowerShell command. Quoting
the PowerShell string protected interpolation, but PowerShell 5.1 still removed embedded
double quotes when handing that string to a native process. The resulting MCP JSON
was invalid. String-only profile tests did not observe the actual process argument vector.
The fix is on the development branch and has not been merged or released.

## What did not work

Adding another layer of PowerShell escaping did not preserve every combination of
spaces and quotes. A trial using a global `.cmd` wrapper through cross-spawn also
truncated the fixture's JSON URL at an ampersand. An intermediate Electron executable
in Node mode preserved arguments but did not produce usable terminal output and hung
the desktop teardown in this environment. That intermediate launcher was removed.

## Solution

[CLI resolution](../../../src/main/terminal/resolve-cli.ts) finds the selected CLI on
PATH. Native `.exe`/`.com` files run directly. For standard npm installations, it locates
the known package's declared `bin` entry and runs it with native Node.js. It does not
execute the `.cmd` wrapper. Unsupported wrappers fail with an installation message.

[TerminalService](../../../src/main/terminal/service.ts) passes the executable and
argument array directly to `node-pty`. Provider and connector credentials remain in
that process's environment. PowerShell remains available as an interactive terminal,
but is not the transport for launching a coding CLI inside the ADE.

## Verification and prevention

[The desktop regression](../../../tests/desktop/cli.e2e.ts) creates standard npm fixture
packages under a directory containing spaces, launches both CLI choices through the UI,
and inspects what the real child processes received. It compares exact JSON/TOML
arguments containing quotes, spaces, parentheses and ampersands, checks token environment
delivery, and closes each process. The Codex case closes through connector disconnection.
This passed both from source and in the final Windows package.

When changing terminal launch behavior, test the received argument vector, visible PTY
output and shutdown together. A correct generated command string alone proves none of
those. This regression verifies launch transport, not real provider inference or service login.

## Related evidence

- [Desktop checkpoint](../../verification/2026-10-03-desktop-workspace.md)
