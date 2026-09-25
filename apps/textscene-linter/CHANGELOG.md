# Changelog

All notable changes to the TSCN linter CLI are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

0.9.0 is the first tracked release.

## [Unreleased]

### Added
- `--format json`: a single pretty-printed JSON array of findings (one object
  per diagnostic, plus a synthetic `file-read-error` finding per unreadable
  file) for machine consumption in CI.
- `--format github`: GitHub Actions workflow-command annotations
  (`::error`/`::warning`/`::notice`) so CI surfaces lint results inline on
  the diff. Auto-detected when `$GITHUB_ACTIONS=true` and `--format` is not
  passed explicitly.
- Directory arguments (for example `tscn-lint scenes/`) recurse into every
  `.tscn` file underneath instead of throwing `EISDIR`.

## [0.9.0] - 2026-06-10

### Added
- `tscn-lint` binary: lint one or more `.tscn` files from the command line.
- Two-phase validation: strict syntax parsing with line/column locations, followed by semantic rules with error, warning, and info severities.
- Rule coverage for 30+ node types: meshes, lights, cameras (2D and 3D), WorldEnvironment, Label3D, sprites (2D, 3D, animated), physics bodies and collision shapes (2D and 3D), audio players, animation nodes, particles, paths, and skeletons.
- CI-friendly exit codes: 0 when all files are clean or carry only warnings/info; 1 when any file has errors or cannot be read.
- Colored, per-file streaming output; `--no-color` to disable.
- Lean bundle: no three.js or React in the CLI.
