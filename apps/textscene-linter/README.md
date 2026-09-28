# @textscene/linter

`tscn-lint` checks Godot `.tscn` scenes and `.tres` resources, without a Godot
install. It reports syntax errors with line and column, then missing
resources, invalid references and property values that Godot refuses or
changes. Every check is grounded in Godot's own source
([ADR-0032](https://github.com/Vortiago/textscene-inspector/blob/main/docs/adr/0032-diagnostics-are-grounded-in-the-engine-source.md)).

## Install

Requires Node.js 24 or later.

```bash
npm install --global @textscene/linter
```

Or run it once: `npx @textscene/linter scenes/`

## Usage

```bash
tscn-lint scenes/main.tscn            # one file
tscn-lint scenes/*.tscn levels/*.tscn # several files
tscn-lint scenes/                     # every .tscn and .tres file underneath
tscn-lint --no-color scenes/          # no ANSI colours
```

## Output formats (`--format`)

- `text` (default): coloured, streamed per file.
- `json`: one JSON array with one finding per diagnostic:

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

  `line` and `column` are `null` for a finding about the whole file, such as
  `file-read-error`.
- `github`: GitHub Actions annotations on the diff. It is the default when
  `$GITHUB_ACTIONS=true`.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | No errors. Warnings and info do not fail the run. |
| `1` | An error, or a file that could not be read. |
| `2` | An unknown `--format` value. |

## Build from source

From the repository root:

```bash
pnpm install
pnpm --filter @textscene/linter build
```

The bundle has no React or three.js. `ARCHITECTURE.md` in the repository
describes how the linter imports each node slice.
