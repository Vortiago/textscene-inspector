---
name: e2e-testing
description: Run end-to-end tests for TextScene Inspector rendering validation. Use when running tests, validating rendering output, checking build integration, or automating browser testing with Chrome DevTools MCP.
---

# End-to-end testing

End-to-end tests check complete flows across all packages:

- Web previewer: file upload to rendering.
- VS Code extension: file open to custom editor to rendering.
- Integration: all packages together.

AGENTS.md lists the automated gates (`pnpm test:e2e:web`, `pnpm test:vscode:csp`, `pnpm test:visual`). Use this skill for manual browser checks with the Chrome DevTools MCP server: navigate, run JavaScript in the page, capture screenshots and read console errors.

## Web previewer

```bash
# Build and start
cd packages/textscene-core && pnpm build
cd ../../apps/textscene-web && pnpm build && pnpm preview
```

With the Chrome DevTools MCP server:
1. Open http://localhost:4173.
2. Run a test script: find the elements, upload the file, check the canvas.
3. Read the console for errors.
4. Capture a screenshot.

## VS Code extension

```bash
# Build and package
cd packages/textscene-core && pnpm build
cd ../../apps/textscene-vscode && pnpm build && pnpm package

# Install
code --install-extension textscene-inspector-*.vsix --force
```

Check that:
- The extension builds with no errors.
- The package step creates a valid `.vsix`.
- The logs show no runtime errors.

## Integration

From the project root:
```bash
pnpm build && pnpm test && pnpm type-check && pnpm lint
```

## Fixtures

Put fixtures in `scenes/fixtures/` with `unit-*` or `edge-*` names. Cover a basic mesh, several nodes, a camera, a large scene and an invalid file (error handling).

## Principles

- Automate every check with scripts and MCP tools. Do not test by hand.
- Test production builds, not dev mode.
- Stop at the first error.
- Test the critical paths only.
