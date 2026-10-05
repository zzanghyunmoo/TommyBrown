# HTTPS and desktop themes checkpoint

Windows x64, Electron 44.5.1. Final package:
`release/windows-20261005135452362/TommyBrown-win32-x64/`.
Packaged main bundle SHA-256:
`1307fce3659b47fb3f01a4a3cf9c8427a0e3866dfd95b424aca0fc49869ef7d1`.

## Acceptance evidence

| Requirement | Observed result | Evidence |
| --- | --- | --- |
| Default HTTPS | A bare loopback host and port sends a TLS ClientHello to the native fixture. The address bar retains HTTPS after the expected TLS failure against an HTTP-only server; there is no HTTP fallback. | `tests/desktop/browser.e2e.ts`, desktop report |
| Explicit HTTP | Entering `http://` for that same fixture loads the actual isolated WebContentsView; links, back navigation and terminal links work. | `tests/desktop/browser.e2e.ts`, native browser captures |
| URL boundaries | Domains, protocol-relative URLs, localhost, IPv4/IPv6 and ports normalize; explicit HTTP survives; scripts, files, custom schemes, credentials and embedded controls are rejected. | 10 browser-policy unit cases |
| Orca-inspired layout | One header combines selected screen tabs and theme choice. The inset work surface, compact rail and expanded settings width replace the duplicate header and permanent guide column. | Final native settings, editor and browser captures |
| Bright and Dark | Chrome, forms, statuses, xterm foreground/background and Monaco background switch in place. Browser document identity survives both switches. | `themes.e2e.ts`, `browser.e2e.ts`, final captures |
| Retain work | A running native PowerShell session retains its ID and output; an unsaved document survives both switches and saves the exact draft. | `themes.e2e.ts` |
| Persist appearance | Explicit Dark survives renderer reload and a full app close/relaunch with the same isolated profile. Electron nativeTheme is Dark after restart. | `themes.e2e.ts` |
| Storage failure | Invalid/corrupt cosmetic settings recover to the supplied OS default; a failed write retains the prior theme. Concurrent writes complete in order. | `appearance.test.ts` |
| Keyboard and narrow window | Theme selection works by keyboard and preserves focus; remains reachable with sidebar hidden. 960x640 has no root horizontal overflow. | `themes.e2e.ts`, minimum native captures |
| Shared states and contrast | Bright/Dark showcases at 1320, 768 and 375px remain bounded. Ten text/background token pairs per theme meet 4.5:1. | `showcase.e2e.ts`, `themes.e2e.ts` |

## Commands and results

- `bun run check`: passed.
- `bun run lint`: passed without new warnings.
- `bun run test`: 79 passed in 19 files, including real native PTY tests.
- `bun run package:windows`: passed; existing Monaco chunk-size warning remains.
- Set `TOMMYBROWN_PACKAGED_APP` to the final package's executable, then run
  `bun run test:desktop`: all 11 scenarios passed in 57.9 seconds.
- `bun run doctor:react`: 65/100, three existing ConnectorPane callback findings
  and 14 existing warnings. Its command exits nonzero. The startup-await warning
  introduced during development was removed by parallel independent initialization.
  This result is not described as a clean React Doctor pass.

## Visual review

Inspected three rendered iterations: initial palettes exposed an unnecessary scrollbar
in the top tabs; the next verified live editors and terminals; the final combined-header
build recovered another 40px of vertical workspace. Final screenshots show clear selected
states, readable Korean controls and consistent surfaces in both modes.

Ignored local artifacts include `test-results/themes-settings-{light,dark}-native.png`,
`themes-editor-{light,dark}-native.png`, `themes-terminal-{light,dark}-native.png`,
`themes-connectors-{light,dark}-native.png`, `themes-browser-{light,dark}-native.png`,
`themes-minimum-{light,dark}-native.png`, `showcase-{light,dark}-{1320,768,375}.png`,
and `desktop-report.json`, all under `test-results/`. Native captures include browser
child views. These local fixtures may show synthetic paths and are not published.

The contrast harness initially assumed six-digit CSS colors; production minification
uses three-digit equivalents. It now expands both forms. An initial xterm assertion
targeted the obsolete viewport node; xterm 6 applies its theme to the scrollable element
and row text, which the corrected test checks. Neither failure was hidden or waived.

## Sequential code and task review

The workspace forbids delegated agents, so review was performed sequentially in the main
session rather than presented as an independent agent approval. Reviewed the diff against
the two requested behaviors, the product's native-boundary contract and the tab-retention
learning. No blocking finding remained.

The appearance bridge uses the existing trusted sender/frame guard and validates its enum
in main. Remote web pages cannot access it. Disk writes are serialized and atomic; renderer
state changes after persistence succeeds. Subscriptions update mounted editors and PTYs
and are removed on disposal. The original sandbox and navigation restrictions remain.

Developer journey: open a space, run a shell, edit a draft, switch themes and keep working
(pass). Keyboard journey: focus the theme selector, change it, retain focus, hide sidebar
and continue (pass). Small-window journey: use editor, model forms and split browser at
the native minimum (pass). Status visibility, recovery after HTTPS failure, task continuity,
consistent controls and optional guidance were checked against these actual flows.

No screen-reader or human-participant study was performed. Contrast assertions cover the
named application token pairs, not every arbitrary web page or syntax token. Remote sites
retain their own theme. OS validation is Windows only; no mobile Lighthouse/SEO score or
fresh paid-provider inference is claimed. Existing gateway, six-way mapping and CLI fixture
scenarios passed on this package.
