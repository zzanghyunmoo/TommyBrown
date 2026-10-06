---
title: Downloadable Windows and macOS releases
date: 2026-10-06
type: feat
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: user-goal
execution: code
---

# Downloadable desktop releases

## Goal Capsule

Publish TommyBrown v0.1.0 with Windows x64 and macOS arm64/x64 downloads,
checksums, installation instructions and platform-specific validation evidence.

## Product Contract

- R1: A GitHub release provides all three named archives and SHA-256 checksums.
- R2: Each archive launches the native desktop, opens a real terminal, runs the
  managed proxy and exposes shared MCP tools. Existing Windows behavior persists.
- R3: Release notes explain unsigned distribution, separate CLI installation,
  account consent, and the existing Antigravity OpenAI tool limitation.
- R4: Source changes use a feature branch and PR. Release assets contain no
  developer profiles, credentials, test workspaces or private local paths.

## Planning Contract

Use the existing Electron packager and native node-pty prebuilds on matching
GitHub-hosted Windows and macOS runners. Ship portable ZIP archives, preserving
macOS executable permissions and symlinks with ditto. Do not add auto-update or
claim certificate signing/notarization without credentials. A tag identifies the
exact reviewed source; publication follows successful native build/test jobs.

macOS currently fails explicit Windows guards in terminal/service.ts and
proxy/installer.ts. Add Bash sessions with per-session CLI wrappers, executable
discovery including common GUI PATH locations, and checksum-pinned Darwin proxy
archives. Retain the stored powershell selector ID for state compatibility while
displaying a platform-appropriate shell name. External copied commands must match
the host shell. Do not change global CLI configuration or shell startup files.

## Implementation Units

### U1. Native platform support

Files: src/main/terminal/, src/main/proxy/installer.ts,
src/main/proxy/profiles.ts, src/main/models.ts, src/shared/bridge.ts,
src/preload/index.ts, shell-related renderer labels.
Tests: tests/proxy/installer.test.ts, tests/proxy/profiles.test.ts,
tests/workspace/terminal.test.ts and a packaged release smoke test.
Verify pinned Darwin hashes, corrupted/wrong tar entries, literal argument
quoting, executable discovery, real PTY input/exit, model/MCP wrapper inheritance.
Use focused failing tests before changing existing contracts.

### U2. Packaging and CI

Files: scripts/package-desktop.ts, scripts/package-windows.ts,
scripts/archive-release.ts, .github/workflows/desktop-release.yml, package.json.
Native builds run locked installs, checks and tests. Package only application
files; smoke-test the packaged executable before archiving and publishing.
Preserve node-pty executable modes. Fail on unsupported platforms/architectures.
CI uploads test evidence even on failure and never publishes partial releases.

### U3. Publication and evidence

Files: README.md, docs/verification/, docs/solutions/.
Create/update PR, review the final diff, publish the verified version tag and
release archives, then verify anonymous download URLs and hashes. If a native
runner fails, resolve the failure before publication; do not label cross-built
or unlaunched macOS packages as validated.

## Verification Contract

Run typecheck, lint, unit tests, build and packaged smoke tests on the native
platforms. The smoke test must exercise PTY output, settings persistence,
Memory tools and real upstream engine installation/start/stop without account
secrets. Existing credentialed service tests remain outside this release check.
Inspect archive entries, excluded files, checksum manifests and remote assets.

## Planning review

Sequential feasibility/security/scope review: packaging alone would ship broken
macOS terminals; platform runtime work is required. Preserve shell selector IDs
to avoid a migration. Read tar entries without extracting paths. Use native
runners rather than cross-compilation. Certificate provisioning is external;
state its absence visibly instead of implying trusted signing.

## Sources

- https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules
- https://www.electronjs.org/docs/latest/tutorial/code-signing
- https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- https://github.com/router-for-me/CLIProxyAPI/releases/tag/v8.0.10
