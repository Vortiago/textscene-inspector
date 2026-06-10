---
name: e2e-testing
description: Run end-to-end tests for TextScene Inspector rendering validation. Use when running tests, validating rendering output, checking build integration, or automating browser testing with Chrome DevTools MCP.
---

# End-to-End Testing

Validate complete flows across all packages.

## Scope

- Web previewer: File upload → rendering
- VS Code extension: File open → custom editor → rendering
- Integration: All packages working together

## Chrome DevTools MCP

Use for browser automation:
- Launch browser and navigate
- Execute JavaScript in page
- Capture screenshots
- Monitor console errors

## Web Previewer Testing

```bash
# Build and start
cd packages/textscene-core && pnpm build
cd ../../apps/textscene-web && pnpm build && pnpm preview
```

Via Chrome DevTools MCP:
1. Navigate to http://localhost:4173
2. Execute test script (locate elements, trigger upload, verify canvas)
3. Check console for errors
4. Capture screenshot

## VS Code Extension Testing

```bash
# Build and package
cd packages/textscene-core && pnpm build
cd ../../apps/textscene-vscode && pnpm build && pnpm package

# Install
code --install-extension tscn-previewer-*.vsix --force
```

Verify:
- Extension builds without errors
- Package creates valid .vsix
- No runtime errors in logs

## Integration Testing

From project root:
```bash
pnpm build && pnpm test && pnpm type-check && pnpm lint
```

## Test Fixtures

Create in `tests/fixtures/`:
- `simple-mesh.tscn` - Basic test
- `multi-object.tscn` - Multiple nodes
- `with-camera.tscn` - Camera test
- `complex-scene.tscn` - Large scene
- `invalid.tscn` - Error handling

## Testing Principles

- **Automate everything**: Use scripts and MCP tools, not manual testing
- **Test real builds**: Use production builds, not dev mode
- **Fail fast**: Stop on first error, don't continue
- **Keep tests simple**: Focus on critical paths only
