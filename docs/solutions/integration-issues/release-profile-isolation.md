---
title: Keep packaged releases separate from development profiles
date: 2026-10-06
module: desktop-release
problem_type: integration-issues
tags: [electron, release, persistence, profiles, first-run]
---

# Keep packaged releases separate from development profiles

## Symptom and cause

The first downloaded 0.1.0 executable showed workspaces and an Obsidian vault
already configured during development on the same computer. The published ZIP
contained no workspace.json or private workspace paths; the downloaded main
bundle matched the CI release. Both development and packaged startup called
app.setName("TommyBrown") and accepted Electron's default userData location.
WorkspaceStore then restored the existing local workspace.json from that shared
profile. This was local state reuse, not user data embedded in the archive.

## Fix

configureDataDirectory runs before the single-instance lock and app readiness.
Packaged releases use TommyBrown Desktop under Electron's appData directory.
Development keeps its existing userData path. Both userData and sessionData are
set so browser sessions follow the same isolation boundary. An explicitly supplied
TOMMYBROWN_DATA_DIR remains an opt-in override for either runtime.

The new release profile is stable across versions and restarts. There is no
automatic import or deletion of the shared 0.1.0/development profile. Users select
their spaces and authorize accounts in the new release profile once.

## Verification and prevention

- A regression using real WorkspaceStore files failed before the fix: a first
  packaged launch saw the development workspace and vault. It passes after the
  fix and verifies independent restart persistence, unchanged legacy state,
  browser-session separation and explicit override compatibility.
- Windows typecheck and lint passed; 114 unit tests passed, three platform/opt-in
  scenarios skipped. The actual packaged terminal/Memory/proxy restart smoke passed.
- A Windows packaged launch without TOMMYBROWN_DATA_DIR reported zero spaces,
  zero connectors and a stopped/uninstalled proxy in TommyBrown Desktop. The
  existing development workspace file remained byte-identical. Its initial UI
  showed no open spaces or connected accounts.
- Earlier release smoke tests always supplied a fresh explicit data directory.
  They verified clean fixtures and restart behavior but bypassed default profile
  selection. Cover default selection with existing development state as well as
  ordinary isolated release smoke tests.

Sequential main-agent review covered correctness, persistence, browser storage,
override precedence, test sensitivity and scope. No independent agent review is
claimed. The small startup helper did not need further abstraction or cleanup.

See [Electron application paths](https://www.electronjs.org/docs/latest/api/app#appgetpathname)
and [the native release gates](native-desktop-release-gates.md).
