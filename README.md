# TommyBrown

A desktop home for coding agents, shared model access, and connected work.

TommyBrown is under active development. The product contract is in
[the implementation plan](docs/plans/2026-10-02-tommybrown-desktop.md).

## Run on Windows

Install Node.js 24 and Bun, then run:

```sh
bun install --frozen-lockfile
bun run build
bun run start
```

In Model access, install the engine, start the gateway, and connect an account in
your browser. Select a discovered model and Claude Code or Codex, then copy the
PowerShell launch command. The command contains a local gateway key and restores
the previous process environment when the CLI exits. Install the chosen CLI separately.

The gateway uses loopback port 8317. An occupied port produces an error; TommyBrown
does not stop other applications. Closing TommyBrown stops its own gateway.
Account files stay in local application data with Windows access restricted to the
current user. Application keys use OS encryption. Provider token files are managed
by CLIProxyAPI and are not encrypted by TommyBrown itself.

## Development status

The native model-access window, verified engine installer, gateway lifecycle, OAuth
handoff, and opt-in CLI command generation are implemented. Live provider consent
and cross-CLI inference have not yet been verified. The ADE, connectors, offline
vault workflow, and Windows distribution package are still being implemented.
See [verification evidence](docs/verification/2026-10-03-model-access.md).

```sh
bun run check
bun run lint
bun run test
bun run build
bun run test:desktop
bun run smoke:proxy
```

Desktop and smoke tests download the pinned public gateway release. They use isolated
test data and do not complete provider consent or spend model credits.

The intended experience combines:

- Claude Code, Codex, and Antigravity OAuth accounts behind a local CLIProxyAPI gateway.
- Spaces and agents on the left, working tabs above, and a code, Markdown, or browser pane on the right.
- Browser, chat, issue tracker, knowledge, and source control connectors, plus local-only Obsidian vaults.

## References

- [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI): upstream protocol translation and OAuth engine.
- [Quotio](https://github.com/nguyenphutrong/quotio): account management and CLI configuration reference.
- [Herdr](https://github.com/herdrdev/herdr): spaces and terminal-based agent workflow reference.

No upstream application code is copied into this repository. The proxy executable is
downloaded separately from an explicitly pinned upstream release and verified before use.
