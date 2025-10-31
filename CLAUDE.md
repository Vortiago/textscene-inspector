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

## Work Item Workflow

**Purpose**: Reduce context window usage by separating high-level roadmap from detailed implementation notes.

**Structure**:
- `TODO.md` - Compact roadmap (~130 lines) with work item summaries and links
- `work_items/WI{number}.md` - Detailed files with implementation specifics (~500-800 lines each)

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

### ⚠️ MANDATORY: Pre-Commit Checklist

**NEVER commit without running all these checks first:**

```bash
# 1. Build everything
pnpm build

# 2. Type check (catches type errors)
pnpm type-check

# 3. Lint (catches code style issues)
pnpm lint

# 4. Run tests (catches logic errors)
pnpm test

# 5. If you created/modified .tscn files, lint them
pnpm --filter @textscene/linter build
node apps/textscene-linter/dist/cli.js scenes/fixtures/*.tscn scenes/examples/*.tscn
```

**If ANY check fails, fix it before committing.** Do not commit code with errors.

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

### Common Pitfalls to Avoid

**1. Type Assertions - Know When to Cast**

```typescript
// ❌ BAD - Will cause type error
node.properties['__instance_index'] = heading.attributes.index;

// ✅ GOOD - Cast to Record when adding dynamic properties
(node.properties as Record<string, unknown>)['__instance_index'] = heading.attributes.index;
```

**2. Unused Variables - Don't Declare If Not Using**

```typescript
// ❌ BAD - ESLint error: unused variable
const startLine = currentLineNumber;
// ... startLine never used again

// ✅ GOOD - Only declare if you'll use it
// Don't declare it at all if not needed
```

**3. Type Imports - Import Types Correctly**

```typescript
// ❌ BAD - May cause circular dependency
import { SomeType } from './module';

// ✅ GOOD - Use type-only imports
import type { SomeType } from './module';
```

**4. Rebuild After Changes - Don't Forget Dependencies**

```typescript
// If you modify packages/textscene-core/...
// Apps depend on it, so rebuild:
pnpm --filter @textscene/renderer build
// THEN rebuild apps that use it
```

**5. Array Access - Use Non-Null Assertion Carefully**

```typescript
// ❌ BAD - Might be undefined
const line = lines[i];

// ✅ GOOD - Only use ! when you KNOW it exists (e.g., within loop bounds)
const line = lines[i]!; // Safe if: i < lines.length
```

**6. Testing Pattern - Rebuild → Run Tests**

```bash
# ❌ BAD - Running tests without rebuilding
pnpm test  # Uses old build, tests pass but code is broken

# ✅ GOOD - Always rebuild before testing
pnpm --filter @textscene/renderer build
pnpm test
```

### Quick Reference: Fix Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Property 'X' does not exist on type 'Y'` | Type mismatch or missing cast | Add type assertion: `as Record<string, unknown>` |
| `'variable' is assigned but never used` | Declared unused variable | Remove the variable declaration |
| `Cannot find module 'X'` | Missing import or wrong path | Check import path, use type-only imports |
| `Command failed with exit code 2` | Type check failed | Run `pnpm type-check` to see actual error |
| Linter builds but tests fail | Stale build artifacts | Run `pnpm clean` then `pnpm install && pnpm build` |

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

**Integration examples:** When multiple features work together, create integration scenes in `scenes/examples/` (e.g., `integration-all-meshes.tscn` shows all 7 mesh types together).

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
// ❌ WRONG - pulls in renderer + THREE.js (898KB bundle)
import '../nodes/base/node3d/index.js';

// ✅ CORRECT - only linter code (~396KB bundle)
import '../nodes/base/node3d/linterParser.js';
import '../nodes/base/node3d/linter.js';
```

**Why this matters:**
- With 150-200 nodes planned (all with renderers), importing `index.ts` would bundle THREE.js for all nodes
- Linter CLI would balloon from ~400KB to 5-10MB+ unnecessarily
- The "asymmetry" (direct imports for linter, index.ts for renderer apps) is **intentional**

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
