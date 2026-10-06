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

The [final native CI run](https://github.com/zzanghyunmoo/TommyBrown/actions/runs/37456162871)
passed on Windows x64, macOS arm64 and macOS x64 at source commit
`f0b5b60d0205df0ee3d9c59537a05d2dc203298e`. Each job passed typecheck, lint,
unit tests, native packaging, the packaged release smoke and archive creation.
The Mac unit suite also exercised actual Bash model/MCP wrapper arguments and
copied-command environment restoration. Both Mac package screenshots were inspected.

Native runner failures found and fixed before publication:

- node-pty 1.1.0's Mac spawn-helper arrived with mode 666. The install/package
  preparation now sets the matching Darwin helper to 755. Native PTY and packaged
  smoke tests then passed on both architectures.
- macOS canonical temporary paths use /private/var. The vault expectation now
  compares against realpath, preserving the application's canonical-path policy.
- Windows checkout CRLF conversion broke formatting checks. .gitattributes now
  keeps text files LF on all build hosts.
- The Windows CI parent PowerShell 7 passed its module search path through the
  test process to Windows PowerShell. Removing PSModulePath only from the ACL
  verification subprocess restores built-in module loading; the ACL assertions
  remain unchanged and passed on the native runner.

## Published artifacts

[TommyBrown v0.1.0](https://github.com/zzanghyunmoo/TommyBrown/releases/tag/v0.1.0)
was published on 2026-10-06. Its tag resolves to the exact successful CI source
commit above. Three archives and their three checksum files were uploaded.

| Archive suffix | Bytes | SHA-256 |
| --- | ---: | --- |
| windows-x64.zip | 209193992 | 49e4e9c8a7bf291fb713c6fef45ff37488e8d2e0c57e4f5a94560731d173cc90 |
| macos-arm64.zip | 183190080 | b100ed8ec561eed1f85399492dc4b7b09f09daddbf1b03c833fd04af6409fcaf |
| macos-x64.zip | 189334302 | 7f4b5dba621ca465ed673c95c5aa39d1b7d28f07a46a4f167732e4f4e430f54e |

All filenames begin with TommyBrown-0.1.0-. Downloaded CI archives matched their
checksum files. GitHub's uploaded asset sizes and SHA-256 digests matched all six
local files. Anonymous HTTP requests returned 206 with valid ZIP headers for all
three downloads and 200 with exact contents for all checksum files. This was a
range/manifest availability check, not a second full anonymous archive download.

Each archive's application subtree contains only dist, node_modules and
package.json, with version 0.1.0 and no developer name in main/preload bundles.
Mac Mach-O headers match arm64/x64, the matching PTY helper retains mode 755,
and each Mac ZIP preserves 14 symlinks. The release is published from the tested
feature commit; source integration remains in PR #10.

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
