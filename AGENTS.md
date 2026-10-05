# TommyBrown

Follow the parent workspace guardrails. Work on feature branches; never commit or push
directly to main. Keep this repository public-safe: no credentials, local account data,
private paths, browser profiles, or Obsidian vault contents in version control.

## Product authority

Read `docs/plans/2026-10-02-tommybrown-desktop.md` for the complete product contract.
The three requested capabilities are one product. A proxy-only prototype or visual shell
does not satisfy the full goal. Record incomplete or unverified behavior honestly.

## Implementation

- Electron main owns credentials, subprocesses, filesystem access, and remote browser views.
- Renderers are sandboxed, use a narrow typed preload bridge, and never receive provider tokens.
- Use TypeScript with strict boundary validation and focused behavior tests.
- Keep plans in `docs/plans/`, evidence in `docs/verification/`, and learnings in `docs/solutions/`.
- Solutions are organized by category with `module`, `problem_type`, and `tags` frontmatter; they describe verified fixes relevant when revisiting those areas.
- Bracket access for environment and dictionary keys follows TypeScript's `noPropertyAccessFromIndexSignature`; Biome's conflicting `useLiteralKeys` suggestion is disabled.
- Use a project-local dependency lockfile; never change the user's global CLI configuration silently.
- Test against the actual desktop and proxy surfaces before claiming integration complete.
- Follow the workspace's sequential agent policy.
