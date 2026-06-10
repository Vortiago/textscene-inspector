# @textscene/linter

Command-line linter for Godot `.tscn` files, built on `@textscene/core/linter`.
It runs the two-phase validation pipeline: strict parsing (`StrictTscnParser`
catches syntax/format errors with line/column locations), then semantic lint
rules (missing resources, invalid references, property constraints).

## Install / Build

From the repo root:

```bash
pnpm install
pnpm --filter @textscene/linter build
```

This bundles `src/cli.ts` to `dist/cli.js` (the `tscn-lint` bin wraps it).

## Usage

```bash
# Single file
node apps/textscene-linter/dist/cli.js scenes/fixtures/unit-plane-mesh.tscn

# Multiple files via shell glob
node apps/textscene-linter/dist/cli.js scenes/fixtures/*.tscn scenes/examples/*.tscn

# Plain output (no ANSI colors), e.g. for CI logs
node apps/textscene-linter/dist/cli.js --no-color scenes/examples/example-hallway.tscn
```

Diagnostics print to stdout; read failures (missing file, permissions) print
to stderr.

## Exit codes

- `0` — all files clean, or only warning/info diagnostics
- `1` — at least one error-severity diagnostic, or a file could not be read

Warnings do not fail the run; only errors and unreadable files do.

## Architecture notes

- **React/THREE-free bundle**: the linter entry point imports each node
  slice's `index.linter.ts` (linter parser + rules only), never the slice
  `index.ts` that pulls in renderers. This keeps the CLI bundle free of
  react and three.js — guarded by
  `packages/textscene-core/src/linter/reactFree.test.ts`.
- **Where rules live**: each node slice self-registers its lint rules via
  `ruleRegistry` in its `linter.ts`, wired up by the slice's
  `index.linter.ts` (e.g.
  `packages/textscene-core/src/nodes/base/node3d/index.linter.ts`). The
  entry point `packages/textscene-core/src/linter/index.ts` imports them all
  to trigger registration.
