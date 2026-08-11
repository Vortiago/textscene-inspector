# @textscene/linter

Command-line linter for Godot `.tscn` files, built on `@textscene/core/linter`.
It runs the two-phase validation pipeline: strict parsing (`StrictTscnParser`
catches syntax/format errors with line/column locations), then semantic lint
rules (missing resources, invalid references, property constraints).

Its subject is the **text scene file**, whole. It exists because Godot has no
text-scene linter of its own, and the goal is to help you author a sound, valid
`.tscn` regardless of what any previewer chooses to draw. So coverage tracks what
the ENGINE serialises: a property is worth validating because Godot writes it and
reads it back, not because some renderer consumes it. Every diagnostic is
grounded in a line of Godot's own source, and the three severity tiers come from
what the engine actually does with a value (ADR-0032): an **error** is a value the
setter refuses or alters, a **warning** is one outside the property's own editor
hint, and a value the engine simply accepts gets nothing at all. The aim is that
a clean run means the file is sound, and that a diagnostic never fires on a scene
Godot opens without complaint.

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

# Directory argument — recurses into every .tscn file underneath
node apps/textscene-linter/dist/cli.js scenes/

# Plain output (no ANSI colors), e.g. for CI logs
node apps/textscene-linter/dist/cli.js --no-color scenes/examples/example-hallway.tscn
```

Diagnostics print to stdout (`text` format) or stdout as structured output
(`json`/`github` formats, below); read failures (missing file, permissions)
print as findings/annotations in those formats, or to stderr in `text` format.

### Output formats (`--format`)

- `text` (default) — colored, human-readable, streamed per file. `--no-color`
  disables ANSI codes.
- `json` — a single pretty-printed JSON array of findings, one object per
  diagnostic (plus one synthetic `file-read-error` finding per unreadable
  file), each shaped as:

  ```json
  {
    "file": "scenes/broken.tscn",
    "line": 4,
    "column": 10,
    "severity": "error",
    "rule": "strict-parser",
    "message": "Invalid Transform3D",
    "nodeType": "<unknown>",
    "nodeName": "<unknown>"
  }
  ```

  ```bash
  node apps/textscene-linter/dist/cli.js --format json scenes/ > lint-results.json
  ```

- `github` — one [GitHub Actions workflow-command annotation](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#setting-an-error-message)
  per finding (`::error file=...,line=...,col=...::message`, `::warning
  ...` for warnings, `::notice ...` for info), so CI surfaces lint results
  inline on the diff:

  ```bash
  node apps/textscene-linter/dist/cli.js --format github scenes/
  ```

  Auto-detected when `$GITHUB_ACTIONS=true` (i.e. running inside a GitHub
  Actions job) and `--format` is not passed explicitly; pass `--format text`
  to opt back into human-readable output there.

## Exit codes

- `0` — all files clean, or only warning/info diagnostics
- `1` — at least one error-severity diagnostic, or a file could not be read
- `2` — an unrecognized `--format` value was passed

Warnings do not fail the run; only errors and unreadable files do. The exit
code contract is identical across all three output formats.

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
