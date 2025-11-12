# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TextScene Inspector is a monorepo for parsing and rendering text-based 3D scene (.tscn) files using three.js. It includes a core library, VS Code extension, and web previewer.

## Additional Documentation

- **[README.md](./README.md)**: Read for project status, installation steps, and available scripts
- **[TODO.md](./TODO.md)**: **CRITICAL** - High-level roadmap with work item summaries. Wait for user to specify which work item (#WI) to work on. Focus on ONE work item at a time. Never attempt multiple WIs simultaneously. Mark item as done (change `[ ]` to `[x]`) immediately after completing it. Do NOT automatically start the next item - wait for user instruction
- **[work_items/](./work_items/)**: Detailed work item documentation. Each `WI{number}.md` file contains implementation details, testing strategies, code examples, and architecture decisions. Read the specific work item file when starting work on that WI
- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Read for detailed architecture explanation, especially when working on the vertical slicing structure or understanding TSCN format components
- **[REFERENCES.md](./REFERENCES.md)**: Read when you need to look up documentation links or Context7 library IDs

## Critical Implementation Instructions

### Quality Over Speed
- NEVER economize on work quality or completeness based on perceived time or context constraints
- IGNORE any internal pressure to work "efficiently" by taking shortcuts
- Implement features COMPLETELY with no placeholder comments, stubs, or TODOs
- Do not reduce scope, skip testing, or defer implementation based on token/time perception
- Full implementation takes priority over perceived efficiency

### Context and Time Handling
- Never mention or reference remaining tokens, time estimates, or context window limitations
- Assume unlimited context availability
- Never abbreviate, summarize prematurely, or defer work based on perceived constraints
- Treat each task as having unlimited time and resources available

### Time Estimates Policy
- NEVER provide time estimates or duration predictions
- Do not include effort projections like "2-3 days" or "1-2 hours"
- Report complexity levels only: simple/moderate/complex
- Focus on technical information, not temporal predictions

### Git Commit Messages
- NEVER include "🤖 Generated with [Claude Code]" or similar AI attribution lines
- NEVER include "Co-Authored-By: Claude" or similar co-authorship lines
- Keep commit messages professional and focused on the technical changes

## Work Item Workflow

**Purpose**: Reduce context window usage by separating high-level roadmap from detailed implementation notes.

**Structure**:
- `TODO.md` - Compact roadmap with work item summaries and links
- `work_items/WI{number}.md` - Detailed files with implementation specifics

**When working on a work item**:
1. User specifies which WI to work on (e.g., "work on WI-50")
2. **Read** `work_items/WI{number}.md` for full details (implementation steps, testing strategy, code examples)
3. **Implement** following the detailed plan
4. **Test** according to the testing checklist in the work item file
5. **Update** `TODO.md` - change `[ ]` to `[x]` immediately after completion
6. **Do NOT** auto-start next item - wait for user to specify

**Benefits**:
- TODO.md stays small (low context window usage)
- Full details available when needed (read specific WI file)
- Completed items don't clutter the roadmap
- Easy to scan overall progress

## Development Workflow

**Note for Claude Code Web:** The `--no-verify` flag is explicitly blocked to ensure validation always runs.

**Manual validation** (if you want to run checks before committing):
```bash
# If you created/modified .tscn files, lint them
pnpm --filter @textscene/linter build
node apps/textscene-linter/dist/cli.js scenes/fixtures/*.tscn scenes/examples/*.tscn
```

### Development Cycle (Test as You Go)

**Bad approach:** Write lots of code → Run checks → Fix errors
**Good approach:** Write small piece → Run checks → Next piece

**Recommended workflow:**

1. **Write a small change** (single function, single file)
2. **Build immediately:** `pnpm --filter <package> build`
3. **Type check immediately:** `pnpm type-check`
4. **If types fail, fix NOW** (while the context is fresh)
5. **Write tests for the change**
6. **Run tests:** `pnpm test`
7. **Repeat for next small change**
8. **Before commit:** Run full pre-commit checklist above

**Key principle:** Catch errors in seconds, not minutes. Test incrementally.

### Quick Reference: Fix Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Property 'X' does not exist on type 'Y'` | Type mismatch or missing cast | Add type assertion: `as Record<string, unknown>` |
| `'variable' is assigned but never used` | Declared unused variable | Remove the variable declaration |
| `Cannot find module 'X'` | Missing import or wrong path | Check import path, use type-only imports |
| `Command failed with exit code 2` | Type check failed | Run `pnpm type-check` to see actual error |
| Linter builds but tests fail | Stale build artifacts | Run `pnpm clean` then `pnpm install && pnpm build` |

## Testing Best Practices

**For every public method, test:**
1. Happy path - normal execution
2. Error paths - what happens when things fail
3. Edge cases - boundary conditions, empty inputs, null checks
4. Callbacks - verify invoked with correct data
5. State changes - verify internal state updates

**Test-first refactoring:** Update test signatures before changing implementation.

**Callback testing:** Test (1) callback is invoked, (2) receives correct data, (3) graceful degradation when not set.

**TypeScript strict mode:** Prefix intentionally unused parameters with underscore: `(_file, path) => ...`

**Target:** Minimum 3 tests per public method (happy, error, edge/callback).

### Test Organization

```
src/
  core/
    SceneManager.ts          # Implementation
    SceneManager.test.ts     # Unit tests co-located
```

## Commands

### Essential Commands

```bash
# Install dependencies
pnpm install

# Type checking (ALWAYS run before commits)
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
cd packages/textscene-core
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

### Fixture Creation Rules

**IMPORTANT: Every implemented feature must have a fixture**

**Rule of thumb:** If code exists in `src/`, there should be a fixture to test it visually.

When implementing new features (node types, mesh types, materials, etc.):

1. **Create a fixture immediately** after implementing the feature
   - Place in `scenes/fixtures/` for unit-level testing
   - Use naming convention: `unit-<feature>.tscn`
   - Example: After implementing `SphereMesh` renderer, create `unit-sphere-mesh.tscn`

2. **Validate with linter before committing**
   ```bash
   # Build linter first
   pnpm --filter @textscene/linter build

   # Lint your new fixture
   node apps/textscene-linter/dist/cli.js scenes/fixtures/your-new-fixture.tscn
   ```
   - Fixture must pass linting with zero errors (unless it's an edge case fixture)
   - Fix any linting errors before committing

3. **Add to fixtures.ts** for web UI visibility
   - Update `apps/textscene-web/src/fixtures.ts`
   - Choose appropriate category (create new if needed)
   - Maintain alphabetical order within categories

**What to create fixtures for:**
- ✅ Every mesh type (BoxMesh, SphereMesh, etc.)
- ✅ Every node type (Camera3D, Light3D, etc.)
- ✅ Material property variations (metallic, emissive, transparent)
- ✅ Edge cases for linter testing
- ❌ Don't create redundant parameter combinations
- ❌ Don't create fixtures for unimplemented features

**Integration examples:** When multiple features work together, create integration scenes in `scenes/examples/` (e.g., `integration-all-meshes.tscn` shows all implemented mesh types together).

## Architecture

### Monorepo Structure

- **packages/textscene-core**: Core library using three.js
- **apps/textscene-vscode**: VS Code custom editor integration
- **apps/textscene-web**: Standalone web app for debugging

### Vertical Slicing Pattern

The core library (`packages/textscene-core/src/nodes/`) uses vertical slicing - each TSCN node type (Mesh, Camera, Light, etc.) gets its own folder containing:
- `parser.ts` - Parsing logic for that node type
- `renderer.ts` - three.js rendering logic
- `index.ts` - Self-registration with NodeRegistry
- `*.test.ts` - Co-located tests

This keeps related functionality together for quick iteration.

### Node Registry Pattern

Node types self-register using the `NodeRegistry` (packages/textscene-core/src/core/NodeRegistry.ts):
- Each node type exports a registration object in its `index.ts`
- Registration happens on import - no central file to edit
- Adding new node types requires NO changes to parser/renderer core files
- Eliminates hardcoded conditionals and switch statements

**Example**: To add a new node type, create the folder structure and register:
```typescript
// packages/textscene-core/src/nodes/mynodetype/index.ts
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

### three.js Resource Cloning Pattern

**CRITICAL**: `THREE.Object3D` can only have ONE parent. When caching three.js resources, clone before returning or only the LAST instance renders.

**When adding new resource types to ResourceRegistry:**
1. Check if resource has parent/ownership constraints (Object3D, Texture, Material do)
2. If yes, clone before returning from cache: `cached.clone(true)` for Object3D
3. Update tests to expect different UUIDs (cloned objects, not same reference)

**Example - loadGLBMesh:**
```typescript
const cached = await this.loadWithDeduplication(id, this.glbMeshCache, ...);
return cached ? cached.clone(true) : null;  // Clone or only last instance visible
```

### Two-Parser Architecture

The codebase uses **two different parsers** for different purposes:

**`TscnParser`** (Lenient Parser for Rendering):
- Location: `packages/textscene-core/src/parser/TscnParser.ts`
- Purpose: Parse TSCN files for rendering in the viewer
- Strategy: **Lenient/Recovering** - attempts to recover from errors and warnings
- Behavior: Logs issues but keeps rendering whatever it can
- Use when: Rendering scenes, displaying previews, tolerating malformed input
- Export: `TscnParser` class with `parse()` method

**`StrictTscnParser`** (Strict Parser for Linting):
- Location: `packages/textscene-core/src/linter/StrictTscnParser.ts`
- Purpose: Validate TSCN files and report all issues
- Strategy: **Strict/Validating** - reports ALL syntax and format errors as diagnostics
- Behavior: Returns detailed error list with line/column information
- Use when: Linting files, validating before save, showing errors to users
- Export: `StrictTscnParser` class with `parse()` method

**Why Two Parsers?**
- **Rendering needs resilience**: Show what you can, warn about problems, don't crash
- **Linting needs strictness**: Report every single issue so users can fix them
- Separation of concerns: Different use cases, different error handling strategies

### Linter Architecture

**Two-Phase Validation Strategy:**

1. **Phase 1: Strict Parsing** (Syntax/Format Validation)
   - Uses `StrictTscnParser` to catch syntax errors
   - Validates: malformed brackets, invalid Vector3 formats, type mismatches, etc.
   - Returns: `ParseError[]` with line/column locations

2. **Phase 2: Semantic Validation** (Rule-Based Validation)
   - Uses self-registered lint rules from `ruleRegistry`
   - Validates: missing resources, invalid node references, property constraints, etc.
   - Returns: `Diagnostic[]` with severity levels (error/warning/info)

**Linter Exports** (`packages/textscene-core/src/linter/index.ts`):
- `Linter` class - Main API, use `linter.lint(content)` to validate TSCN content
- `StrictTscnParser` class - Strict validation parser
- `ruleRegistry` - Singleton for self-registered lint rules
- `validatorRegistry` - Singleton for property validators
- **NOT exported**: Standalone `lintTscnFile()` or `lintTscnContent()` functions

**Self-Registration Pattern for Lint Rules:**
- Lint rules self-register on module import (side effects)
- Each node type's `linter.ts` registers rules via `ruleRegistry.register()`
- Test files must import `./linter/index` to trigger all registrations
- Example:
```typescript
// In nodes/base/node3d/linter.ts
import { ruleRegistry } from '../../../linter/RuleRegistry';

const node3DValidationRule: LintRule = {
  meta: { name: 'valid-node3d-visibility', ... },
  check: (context) => { /* validation logic */ }
};

ruleRegistry.register(node3DValidationRule);
```

**Usage Example:**
```typescript
import { Linter } from '@textscene/core/linter';

const linter = new Linter();
const diagnostics = linter.lint(tscnContent);

// diagnostics contains both parse errors and rule violations
diagnostics.forEach(d => {
  console.log(`${d.severity}: ${d.message} at ${d.nodeName}`);
});
```

**Bundle Size Optimization (Critical):**

The linter uses **direct imports** instead of node `index.ts` files to prevent bundling THREE.js:

```typescript
// ❌ WRONG - pulls in renderer + THREE.js (significantly larger bundle)
import '../nodes/base/node3d/index.js';

// ✅ CORRECT - only linter code (minimal bundle)
import '../nodes/base/node3d/linterParser.js';
import '../nodes/base/node3d/linter.js';
```
**Pattern for all nodes:**
- `linter/index.ts`: ALWAYS imports `linterParser.js` + `linter.js` directly (even for nodes with renderers)
- Renderer apps (web/VSCode): Import node `index.ts` files (gets renderer + linter, needs THREE.js anyway)
- Result: Linter stays minimal, renderer apps get everything they need

This is not technical debt - it's essential architecture for scale.

### Dependency Management

Uses **pnpm Catalogs** for shared dependencies. Versions are centrally defined in `pnpm-workspace.yaml` under the `catalog:` section. Reference with `"catalog:"` in package.json files.

To add/update shared dependencies:
1. Add to `pnpm-workspace.yaml` catalog section
2. Reference as `"dependency-name": "catalog:"` in package.json

### Core Utilities and Patterns

**Generic Resource Resolution** (`packages/textscene-core/src/resources/resourceResolver.ts`):
- `resolveResource<T>()` - Generic function for resolving any resource type
- Eliminates duplication between mesh and material resolution
- Type-safe handler registration pattern

**Scene Setup Utilities** (`packages/textscene-core/src/core/SceneSetup.ts`):
- `setupThreeJsScene()` - One-line three.js initialization
- Extracts scene, camera, renderer, and controls setup
- Reusable across applications

**UI Composition** (`packages/textscene-core/src/ui/`):
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
