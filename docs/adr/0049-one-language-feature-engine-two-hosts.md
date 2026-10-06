# One language-feature engine, two hosts

- Status: Accepted (2026-10-04).
- Related: ADR-0001 (React-free slice entry points), ADR-0002 (the three registries),
  ADR-0020 (the web Source pane), ADR-0021 (the VS Code preview refresh), ADR-0032 (diagnostics
  are grounded in the engine source).

## Context

The VS Code extension already answered `DocumentSymbol`, `Definition`, `DocumentLink` and
diagnostics as native providers over `@textscene/core`. It had no hover, completion, quick fixes,
folding or document highlights, and other editors had none of it. The extension runs in
vscode.dev as well as on the desktop, through a `browser` bundle and the `test:web` gate.

Two shapes were possible. A language server process carries every feature to every editor, but
vscode.dev cannot spawn one. A separate language-feature engine in each host would copy Godot's
property tables, hints and deprecated aliases, and the copies would drift.

## Decision

**One React- and THREE-free engine, `@textscene/core/languageFeatures`, over two hosts.**

- The language-feature engine parses the text through the scanning loop with a `ParseObserver` and
  answers `hoverAt`, `completionsAt`, `codeActions`, `foldingRanges`, `documentHighlights`,
  `documentSymbols`, `declarationRangeAt`, `resPathAt` and `resPathOccurrences`. Every result is
  host-neutral with zero-based ranges, the convention LSP and the VS Code API share, so a host
  adapts no position. A host maps each result to its own types and adds no feature logic.
- The language-feature engine reads a resource reference through `godot/resourceRef.ts`, as the
  linter and the renderer do. So the old integer form `ExtResource(1)` resolves in every host.
- The language-feature engine reads the same `godot/` ClassDB captures, base-type tables and
  deprecated-alias table as the linter. `pnpm nodes:base-types` generates the per-class property
  tables beside the base types.
- The VS Code extension registers **native providers** over the language-feature engine. This keeps
  the desktop and vscode.dev paths identical, and needs no server process.
- The `tscn-lsp` server (`apps/textscene-lsp`, package `@textscene/lsp`) serves the same
  language-feature engine to any LSP client over stdio. It reads the project from the nearest
  `project.godot`, and it imports no VS Code API. It reads the disk through
  `@textscene/core/resources/diskProject`, the provider the `tscn-lint` CLI uses. An ESLint rule
  keeps that Node-only module out of every browser bundle.
- The extension's **agent tools** (`vscode.lm`) are extension-only: lint a scene, read its node
  tree, open its preview, list its missing resources, and capture the preview as a PNG. They
  call the same linter, parsers and viewport capture. The capture tool needs the image part of a
  tool result, stable from VS Code 1.106, so the extension registers it only where VS Code has
  that part.

A path-completion seam takes an async `listPaths` callback, so the extension lists the workspace
and the server lists the filesystem. The language-feature engine knows neither. It calls the
seam only for a cursor inside a `res://` value, so a host lists the project only then. Both
listings follow the Godot editor's scan rules: no dot-named directory, no nested project and no
`.gdignore` directory.

## Considered Options

- **The extension as an LSP client** (`vscode-languageserver-node`): rejected. vscode.dev cannot
  spawn a server process, so the browser build would need a worker-based server or lose the
  features. Native providers keep one code path for both.
- **The `tscn-lsp` server only**: rejected. It leaves desktop VS Code with a process to manage and
  no benefit over the native API.
- **A language-feature engine per host**: rejected. The ClassDB property tables, the hint strings
  and the deprecated aliases are engine facts, and two copies drift.
- **The language features in the server only, and agent tools only in the extension**: rejected.
  Hover, completion, quick fixes, folding and document highlights are editor features, not chat
  features.
