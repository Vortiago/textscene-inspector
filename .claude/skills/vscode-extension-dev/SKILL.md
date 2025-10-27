---
name: vscode-extension-dev
description: Develop and debug VS Code extension for .tscn files. Use when working on custom editor features, webview integration, extension packaging, or implementing the .tscn editor in apps/textscene-vscode.
---

# VS Code Extension Development

VS Code extension: `apps/textscene-vscode`

## Architecture

```
src/
├── extension.ts        # Entry point, register custom editor
├── editor/
│   ├── provider.ts     # CustomEditorProvider implementation
│   └── webview.ts      # Webview setup and messaging
└── webview/            # Webview UI using tscn-renderer
```

## Custom Editor Pattern

1. Register in `extension.ts`: `vscode.window.registerCustomEditorProvider()`
2. Implement `CustomReadonlyEditorProvider` in `editor/provider.ts`
3. Setup webview in `editor/webview.ts` with message passing

## Message Passing

**Extension → Webview:**
```typescript
panel.webview.postMessage({ type: 'loadScene', content: tscnFileContent });
```

**Webview → Extension:**
```typescript
vscode.postMessage({ type: 'error', message: 'Failed to parse' });
```

## Workflow

```bash
cd apps/textscene-vscode
pnpm type-check && pnpm lint:fix && pnpm test && pnpm build && pnpm package
```

Creates `.vsix` file for distribution or testing:
```bash
code --install-extension tscn-previewer-*.vsix
```

## Development Principles

- **KISS**: Keep implementations simple, avoid over-engineering
- **DRY**: Don't repeat yourself, but avoid premature abstraction
- **Iterative**: Build working code first, refine later
- **No documentation**: Don't create README files or excessive comments - code should be self-explanatory

## Context7 Docs

- VS Code API: `/websites/code_visualstudio_api`
