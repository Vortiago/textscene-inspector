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

## Project files

When the scene's own directory, or a directory above it, holds
`project.godot`, `tscn-lint` resolves `res://` paths from there. It then also
reads each `.glb` and `.gltf` file the scene uses, and reports one that requires
a glTF extension Godot's importer does not support. Where a sub-resource, a
`.tres` `[resource]` body, a connection or the scene's root node uses the glTF
file, Godot fails to load the scene or resource that uses it. The report is then
an error when `project.godot` enables no editor plugin and declares no autoload,
and no directory Godot's editor scans holds a `.gdextension` file. Otherwise it
is a warning, because an editor plugin, an autoload or a GDExtension can add
support for the extension. Where only other nodes use the glTF file, the scene
loads without it, and the report is always a warning. `tscn-lint` reads the
`.gdextension` files themselves, so a fresh checkout without `.godot/` gets the
same answer as the editor. `tscn-lint` checks a scene outside every Godot
project alone.

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

Every format writes a control character from a scene, such as ESC, as a
visible escape (`\u001b`), so a scene cannot send a command to your terminal.

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
