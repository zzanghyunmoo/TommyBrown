# HTTPS defaults and a quieter desktop

## Scope

Addresses without a scheme open with HTTPS, including local hosts and ports. Only
explicit `http://` input opts into HTTP; unsupported schemes and credentials remain
rejected. Existing explicit HTTP development links continue to work.

Give TommyBrown an Orca-inspired workbench: compact navigation, clearly selected
workspace tabs, an inset working surface, and settings that use the available width.
Provide Bright and Dark choices in the persistent header. Save the choice in the
app profile and apply it to native chrome, controls, Monaco and xterm without
recreating sessions, editors or browser views. Remote pages retain their own styles.

## Design and implementation

Follow DESIGN.md. The official Orca terminal screenshot supplies the spatial
reference; Linear supplies luminance hierarchy, not copied branding. Keep native
Segoe UI and Radix icons. Replace the permanent settings guide column with optional
inline help. Keep pane scroll ownership and the 60/40 browser support split.

1. Normalize addresses at the shared main-process trust boundary; add edge cases.
2. Store a validated theme in userData, with atomic serialized writes. Expose only
   get/set through the authorized preload bridge. Initialize before rendering.
3. Update shared tokens, shell, settings and selected states. Update mounted Monaco
   and xterm instances through theme subscriptions rather than remounting them.
4. Exercise actual packaged Electron: HTTPS/HTTP, both themes, reload/restart,
   unsaved editor text, running PTY, browser retention, keyboard and narrow window.
5. Run type/lint/unit/desktop checks; inspect native screenshots; record the review
   and reusable learning. Reopen the verified package for the user.

## Review and acceptance

Sequential plan review: the preference is local, the bridge uses the existing sender
guard, remote content gets no appearance bridge, and failed writes must be visible
without claiming that the selection was saved. Theme changes must not remount work.
Address tests must cover host:port versus forbidden schemes, whitespace and credentials.

The primary user runs agents alongside a browser. A keyboard-only user must reach
the theme selector and distinguish selected tabs. Korean labels must remain legible
at 960x640. Normal text targets 4.5:1 contrast in each palette. Reduced motion must
not animate layout. Native captures are the visual authority for WebContentsView;
DOM screenshots alone cannot prove the composite. No website Lighthouse/SEO claim
applies to this privileged, file-loaded desktop app.

No new provider behavior, telemetry, dependency or global CLI setting is required.
