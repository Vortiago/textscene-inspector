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
vscode.dev cannot spawn one. A separate engine in each host would state the engine's property
tables, hints and deprecated aliases twice, and drift.

## Decision

**One React- and THREE-free engine, `@textscene/core/languageFeatures`, over two hosts.**

- The engine parses the text through the scanning loop with a `ParseObserver` and answers
  `hoverAt`, `completionsAt`, `codeActions`, `foldingRanges` and `documentHighlights`. Every
  result is host-neutral with zero-based ranges, the convention LSP and the VS Code API share, so
  a host adapts no position.
- It reads the same `godot/` ClassDB captures, base-type tables and deprecated-alias table as the
  linter. `pnpm nodes:base-types` generates the per-class property tables beside the base types.
- The VS Code extension registers **native providers** over the engine. This keeps the desktop
  and vscode.dev paths identical, and needs no server process.
- `apps/textscene-lsp` (`@textscene/lsp`, `tscn-lsp`) serves the same engine to any LSP client
  over stdio, reading the project from the nearest `project.godot`. It imports no VS Code API.
- The extension's **agent tools** (`vscode.lm`) are extension-only: lint a scene, read its node
  tree, open its preview, list its missing resources, and capture the preview as a PNG. They
  call the same linter, parsers and viewport capture. The capture tool needs the image part of a
  tool result, stable from VS Code 1.106, so it registers on its own guard.

A path-completion seam takes a `listPaths` callback, so the extension lists the workspace and the
server lists the filesystem without the engine knowing either.

## Considered Options

- **The extension as an LSP client** (`vscode-languageserver-node`): rejected. vscode.dev cannot
  spawn a server process, so the browser build would need a worker-based server or lose the
  features. Native providers keep one code path for both.
- **A standalone server only**: rejected. It leaves desktop VS Code with a process to manage and
  no benefit over the native API.
- **An engine per host**: rejected. The ClassDB property tables, the hint strings and the
  deprecated aliases are engine facts, and two copies drift.
- **Language-server-only features in the extension**: rejected. Hover, completion, quick fixes,
  folding and highlights are ordinary editor features, not chat features.
