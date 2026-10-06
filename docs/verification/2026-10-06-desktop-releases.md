---
title: Native desktop release verification
date: 2026-10-06
module: desktop-release
problem_type: integration-issues
tags: [release, windows, macos, electron, packaging]
---

# Desktop release verification

## Windows local evidence

- Typecheck and lint pass.
- Unit suite: 112 passed, one opt-in Antigravity test skipped before adding
  the two macOS-only Bash scenarios. Darwin installer tests failed on the old
  implementation, then passed with platform-specific hashes and tar parsing.
- Packaged release smoke: PASS, one scenario. It opens a native PTY, observes
  output in xterm, calls the bundled Memory server, downloads/checks/starts the
  actual CLIProxyAPI engine, stops it and restarts the app. The second launch
  restores the theme and Memory graph and starts the installed proxy automatically.
- The first new smoke attempt read the asynchronous session list before launch
  completed. It now waits for the rendered terminal before attaching.
- Local Windows ZIP: valid ZIP magic, 10,034 entries. The application subtree
  contains only dist, node_modules and package.json. No local developer name
  appears in the main/preload bundles. The archive contains no app-data directory.
- Native package screenshots and Playwright JSON remain under ignored test-results.

## Native CI publication gate

The Desktop packages workflow must pass separately on Windows x64, macOS arm64
and macOS x64. Native CI and public download verification are pending; local
Windows success does not establish macOS acceptance.

## Review

Sequential main-agent correctness, security, API, packaging and maintainability
review. No independent agent or cross-model review is claimed. Preserve stored
shell IDs and Windows receipt compatibility; never extract archive paths; verify
the pinned upstream checksum before decoding; require executable permission for
POSIX CLI discovery. The Windows development command delegates to the same
packager as CI to avoid diverging packaging rules.

## Limits

No publisher signing certificate or Apple notarization credentials are configured.
macOS packages use an ad-hoc integrity signature, not a trusted publisher identity.
Live account authorization and paid model inference are not performed by CI.
The existing native Antigravity OpenAI tool-invocation limitation remains.
