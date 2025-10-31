# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TextScene Inspector is a monorepo for parsing and rendering text-based 3D scene (.tscn) files using three.js. It includes a core library, VS Code extension, and web previewer.

## Additional Documentation

- **[README.md](./README.md)**: Read for project status, installation steps, and available scripts
- **[TODO.md](./TODO.md)**: **CRITICAL** - Read to understand current progress. Wait for user to specify which work item (#WI) to work on. Focus on ONE work item at a time. Never attempt multiple WIs simultaneously. Mark item as done (change `[ ]` to `[x]` and "Not Done" to "Done") immediately after completing it. Do NOT automatically start the next item - wait for user instruction
- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Read for detailed architecture explanation, especially when working on the vertical slicing structure or understanding TSCN format components
- **[REFERENCES.md](./REFERENCES.md)**: Read when you need to look up documentation links or Context7 library IDs

## Commands

### Essential Commands

```bash
# Install dependencies
pnpm install

# Type checking (run before commits)
pnpm type-check

# Run all tests
pnpm test

# Build all packages
pnpm build

# Lint code
pnpm lint
pnpm lint:fix
```

### Package-Specific Development

```bash
# Core library (tscn-renderer)
cd packages/textscene-renderer
pnpm dev          # Watch mode for TypeScript
pnpm test:watch   # Watch mode for tests

# Web previewer (fast iteration/debugging)
cd apps/textscene-web
pnpm dev          # Start Vite dev server

# VS Code extension
cd apps/textscene-vscode
pnpm dev          # Watch mode
pnpm package      # Create .vsix for testing
```

### Scenes and Web Previewer

**Scene files** are organized in the `scenes/` directory:
- `scenes/fixtures/` - Minimal unit-level scenes for testing individual node types (e.g., `unit-plane-mesh.tscn`)
- `scenes/examples/` - Integration and complex demo scenes (e.g., `integration-all-primitives.tscn`, `example-hallway.tscn`)

Files are automatically copied to the web app during build/dev.

When adding or removing scenes:
1. Place new files in `scenes/fixtures/` or `scenes/examples/` with descriptive names:
   - Fixtures: `unit-<node-type>.tscn`, `edge-<issue>.tscn`
   - Examples: `integration-<feature>.tscn`, `example-<name>.tscn`
2. Files are automatically copied during `pnpm dev` or `pnpm build`
3. **Manually update** `apps/textscene-web/src/fixtures.ts` to add the scene to the UI selector
4. Use appropriate categories (Unit - Basic Nodes, Unit - Primitive Meshes, Edge Cases, Integration - Multi-Node, Examples - Complex Scenes)

Example fixture entry:
```typescript
{ name: 'Plane Mesh', file: 'unit-plane-mesh.tscn', category: 'Unit - Primitive Meshes' }
```

The web previewer includes a categorized scene selector for quick loading during development.

## Architecture

### Monorepo Structure

- **packages/textscene-renderer**: Core library using three.js
- **apps/textscene-vscode**: VS Code custom editor integration
- **apps/textscene-web**: Standalone web app for debugging

### Vertical Slicing Pattern

The core library (`packages/textscene-renderer/src/nodes/`) uses vertical slicing - each TSCN node type (Mesh, Camera, Light, etc.) gets its own folder containing:
- `parser.ts` - Parsing logic for that node type
- `renderer.ts` - three.js rendering logic
- `index.ts` - Self-registration with NodeRegistry
- `*.test.ts` - Co-located tests

This keeps related functionality together for quick iteration.

### Node Registry Pattern

Node types self-register using the `NodeRegistry` (packages/textscene-renderer/src/core/NodeRegistry.ts):
- Each node type exports a registration object in its `index.ts`
- Registration happens on import - no central file to edit
- Adding new node types requires NO changes to parser/renderer core files
- Eliminates hardcoded conditionals and switch statements

**Example**: To add a new node type, create the folder structure and register:
```typescript
// packages/textscene-renderer/src/nodes/mynodetype/index.ts
import { nodeRegistry } from '../../core/NodeRegistry';
import { isMyNodeType, parseMyNodeType } from './parser';
import { createMyNodeType } from './renderer';

nodeRegistry.register({
  typeName: 'MyNodeType',
  typeGuard: isMyNodeType,
  parser: parseMyNodeType,
  renderer: createMyNodeType,
});
```

Then import in TscnParser.ts: `import '../nodes/mynodetype';`

### Dependency Management

Uses **pnpm Catalogs** for shared dependencies. Versions are centrally defined in `pnpm-workspace.yaml` under the `catalog:` section. Reference with `"catalog:"` in package.json files.

To add/update shared dependencies:
1. Add to `pnpm-workspace.yaml` catalog section
2. Reference as `"dependency-name": "catalog:"` in package.json

### Core Utilities and Patterns

**Generic Resource Resolution** (`packages/textscene-renderer/src/resources/resourceResolver.ts`):
- `resolveResource<T>()` - Generic function for resolving any resource type
- Eliminates duplication between mesh and material resolution
- Type-safe handler registration pattern

**Scene Setup Utilities** (`packages/textscene-renderer/src/core/SceneSetup.ts`):
- `setupThreeJsScene()` - One-line three.js initialization
- Extracts scene, camera, renderer, and controls setup
- Reusable across applications

**UI Composition** (`packages/textscene-renderer/src/ui/`):
- `NodeDetailsFormatter` - Generates HTML for node property display
- `SceneTreeViewer` - Interactive tree hierarchy viewer
- `TscnPreviewUI` - Coordinates all UI components

**Feature Parity**: Both web-previewer and vscode-extension share the same tree viewer, node details, and rendering capabilities through the shared tscn-renderer library.

### TSCN Format

Godot's text scene format uses headings: `[type key=value ...]`

Three main components:
- Nodes (scene tree structure)
- External resources (file references like textures)
- Internal resources (embedded data)

See https://docs.godotengine.org/en/4.4/contributing/development/file_formats/tscn.html

## Development Principles

- **KISS and DRY**: Keep implementations simple, avoid premature abstraction
  - Extract utilities when you see clear duplication (Rule of Three)
  - Use generic functions for repeated patterns (resource resolution, HTML generation)
  - Keep single-use code inline until duplication emerges
- **Quick iterations**: Prioritize working code over architectural perfection
- **Co-located tests**: Tests live next to implementation files
- **Minimal documentation**: Update docs only when necessary to reduce context overhead
- **Self-registering patterns**: New features should register themselves, not require editing central files
- **Feature parity**: Keep web-previewer and vscode-extension functionality in sync via shared library

## Logging Guidelines

**Verbose logging is encouraged for rapid prototyping and debugging:**
- Use `logger.info()` liberally for tracing execution flow during development
- Prefix related logs with categories (e.g., `[External Scene]`, `[Parser]`)
- Include relevant context (IDs, paths, counts) to make debugging easier
- Keep `logger.error()` and `logger.warn()` for production issues

**Host applications control log levels:**
- VS Code extension and web app should configure log output filtering
- Production builds can suppress info logs while keeping errors/warnings
- Don't remove verbose logging from the core library - let apps decide what to show

**Example of good verbose logging:**
```typescript
logger.info(`[External Scene] Loading content from: ${resourceMetadata.path}`);
logger.info(`[External Scene] Parsed scene with ${externalScene.nodes.length} root nodes`);
logger.info(`[External Scene] ✅ Successfully loaded external scene: ${path} with ${count} nodes`);
```

## Code Comment Guidelines

Following KISS principles, keep comments concise and informative:

**File Headers:**
- One-line description of purpose
- Example: `/** Parses Godot TSCN text files into a structured format. */`

**JSDoc Comments:**
- Only add when providing non-obvious information
- Omit for simple getters/setters and self-explanatory methods
- Skip `@param`/`@returns` when types already tell the story

**Inline Comments:**
- Remove obvious comments that restate code
- Keep comments for complex algorithms (gimbal lock, rotation extraction)
- Keep security-related notes (nonce generation, CSP)
- Keep non-obvious business logic explanations

**What to Avoid:**
- Work item references (#WI...) - these belong in TODO.md, not code
- Verbose explanations that duplicate type information
- Comments like "Initialize variable" or "Loop through array"
- Restating what the code clearly shows

**Let TypeScript Do the Work:**
- Well-named functions and variables reduce comment needs
- Type signatures document parameters and returns
- Interface properties are self-documenting with good naming
