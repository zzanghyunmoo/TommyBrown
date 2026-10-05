---
title: Change desktop appearance without recreating live work
date: 2026-10-05
module: Desktop appearance
problem_type: integration_issue
tags: [electron, themes, monaco, xterm, persistence, browser]
---

# Change desktop appearance without recreating live work

Treat appearance as state independent of pane identity. Re-keying an editor or terminal
when the theme changes discards draft/undo state or reattaches the terminal unnecessarily.
Persist a validated preference in main, apply nativeTheme there, and update CSS tokens,
Monaco's theme and xterm's options through subscriptions on their existing instances.
Dispose those subscriptions with the original instance. Initialize renderer appearance
before rendering content so the saved mode is present on reload as well as cold start.

Keep the same authorized preload boundary used for other desktop settings. Serialize
atomic preference writes, retain the old value on failure, and show a retryable error.
A disabled native select can lose focus while a write is pending; restore it after the
control is enabled only when the document still owns focus and focus has not moved to
another control. Do not force focus back from a native browser child view.

Observe the surface actually painted by the installed library. In xterm 6,
`.xterm-scrollable-element` receives the background while `.xterm-rows` receives the
foreground. The legacy `.xterm-viewport` node is not proof of the active theme. CSS
minification also shortens colors, so contrast checks must accept three-digit hex.

Address defaults belong at the shared main-process URL boundary, not just the address
input. Distinguish a host and numeric port from an unsupported scheme. Default to HTTPS
even for loopback; explicit HTTP is the user's opt-in. A native HTTP fixture can observe
a TLS ClientHello from a bare address, then serve a real page when the user supplies HTTP.
This proves default protocol selection without external networking or disabled certificate
verification.

See the [verification checkpoint](../../verification/2026-10-05-https-and-desktop-themes.md)
for the packaged desktop results and their limits.
