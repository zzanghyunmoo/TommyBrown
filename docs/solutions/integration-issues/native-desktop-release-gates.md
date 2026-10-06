---
title: Verify native runtime behavior before publishing desktop packages
date: 2026-10-06
module: desktop-release
problem_type: integration-issues
tags: [electron, release, macos, windows, pty]
---

# Verify native runtime behavior before publishing desktop packages

The application originally packaged only Windows. Merely changing the packager's
platform would have shipped an unusable Mac terminal: terminal/service.ts rejected
non-Windows hosts, CLI discovery searched only Windows extensions and the managed
proxy installer selected ZIP/exe releases exclusively.

The release path now selects native shell profiles and proxy archives, retains the
stored shell selector ID, and passes model/MCP arguments through quoted Bash
functions on macOS. Copied launch commands use a subshell to preserve the caller's
environment. Credentials still belong to Electron main and session environments.

Use scripts/package-desktop.ts on a matching host architecture. node-pty has native
prebuilds and executable helpers; a package must actually launch a PTY before it is
publishable. Use ditto for Mac ZIPs so app-bundle symlinks and executable modes
survive. On Windows call the system bsdtar by absolute system path: Git Bash's GNU
tar does not produce ZIP merely because an output filename ends in .zip.

The release smoke in tests/desktop/release.e2e.ts exercises the packaged app,
Memory, real proxy installation and restart restoration. Native Windows x64,
macOS arm64 and macOS x64 runs all passed before publishing v0.1.0.
Require the same native CI gate on both Mac architectures before publication;
do not substitute cross-compilation or a successful bundle command for that gate.

The native jobs exposed node-pty 1.1.0's Darwin spawn-helper mode 666, producing
posix_spawnp failed despite a successful package build. scripts/prepare-native.ts
sets the matching installed helper to 755 during dependency installation and
again before packaging. Both Mac PTY tests then passed, and downloaded ZIPs retain
mode 755. This matches the [upstream node-pty report](https://github.com/microsoft/node-pty/issues/850).

Keep build text files LF with .gitattributes. On macOS compare canonical paths
using realpath rather than assuming /var and /private/var differ. On Windows,
PowerShell 7 can pass incompatible module paths through an intermediate process
to Windows PowerShell. The ACL verification test removes PSModulePath from that
child environment so built-in Get-Acl loads, without relaxing access assertions.
See [Microsoft's module-path guidance](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_psmodulepath?view=powershell-7.6#starting-windows-powershell-from-powershell-7).

An ad-hoc Mac signature establishes bundle integrity, not publisher trust or Apple
notarization. Document first-launch approval and checksums honestly. Keep release
jobs read-only; publish all verified assets together from the reviewed source tag.

See [the release checkpoint](../../verification/2026-10-06-desktop-releases.md).
