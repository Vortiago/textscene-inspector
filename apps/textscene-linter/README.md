# @textscene/linter

Command-line linter for Godot's text formats, `.tscn` scenes and `.tres`
resources, built on `@textscene/core/linter`. It runs two phases: strict
parsing (`StrictTscnParser` catches syntax and format errors with line and
column), then semantic lint rules (missing resources, invalid references,
property constraints).

Its subject is the whole text scene file. Godot has no text-scene linter of its
own. The goal is to help you author a sound, valid file regardless of what any
previewer draws. Coverage therefore tracks what the engine serialises. A
property is worth validating because Godot writes it and reads it back, not
because a renderer consumes it. Every diagnostic is grounded in a line of
Godot's own source. Its severity (error, warning or info) follows what the
engine does with the value (ADR-0032, defined under **Severity** in the root
`CONTEXT.md`). A clean run means the file is sound. A diagnostic never fires on
a scene Godot opens without complaint.

## Install / Build

From the repo root:

```bash
pnpm install
pnpm --filter @textscene/linter build
```

This bundles `src/cli.ts` to `dist/cli.js`. The `tscn-lint` bin, and
`pnpm lint:tscn` at the repo root, wrap it.

## Usage

```bash
# Single file
node apps/textscene-linter/dist/cli.js scenes/fixtures/unit-plane-mesh.tscn

# Multiple files via shell glob
node apps/textscene-linter/dist/cli.js scenes/fixtures/*.tscn scenes/isometric/*.tscn

# Directory argument — recurses into every .tscn file underneath
node apps/textscene-linter/dist/cli.js scenes/

# Plain output (no ANSI colors), e.g. for CI logs
node apps/textscene-linter/dist/cli.js --no-color scenes/examples/example-hallway-mockup.tscn
```

A directory argument is walked for both `.tscn` and `.tres` files.

Diagnostics print to stdout in every format. In `text` format a read failure
(missing file, permissions) prints to stderr. In the `json` and `github`
formats it prints as a finding or annotation, so the output stays
machine-readable.

### Output formats (`--format`)

- `text` (default): coloured, human-readable, streamed per file. `--no-color`
  disables ANSI codes.
- `json`: a single pretty-printed JSON array of findings, one object per
  diagnostic, plus one synthetic `file-read-error` finding per unreadable
  file. Each is shaped as:

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

- `github`: one [GitHub Actions workflow-command annotation](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#setting-an-error-message)
  per finding (`::error file=...,line=...,col=...::message`, `::warning
  ...` for warnings, `::notice ...` for info), so CI surfaces lint results
  inline on the diff:

  ```bash
  node apps/textscene-linter/dist/cli.js --format github scenes/
  ```

  It is auto-detected when `$GITHUB_ACTIONS=true` (inside a GitHub Actions
  job) and `--format` is not passed. Pass `--format text` to opt back into
  human-readable output there.

## Exit codes

- `0`: all files clean, or only warning and info diagnostics
- `1`: at least one error-severity diagnostic, or a file could not be read
- `2`: an unrecognised `--format` value

Warnings do not fail the run. Only errors and unreadable files do. The exit
code contract is identical across all three output formats.

## Architecture notes

- **React- and THREE-free bundle**: the linter entry point
  (`packages/textscene-core/src/linter/index.ts`) imports each node slice's
  `index.linter.ts` (linter parser and rules only) and each resource slice's
  validators. It never imports a slice `index.ts` or `index.r3f.ts`, which pull
  in a renderer. `packages/textscene-core/src/linter/reactFree.test.ts` and
  this package's `src/reactFree.test.ts` guard it.
- **Where rules live**: each node slice registers its lint rules through
  `ruleRegistry` in its `linter.ts`, wired by the slice's `index.linter.ts`
  (for example `packages/textscene-core/src/nodes/base/node3d/index.linter.ts`).
  The entry point imports them all to trigger registration.
