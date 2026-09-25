---
name: textscene-dev
description: Full-stack development for TextScene Inspector monorepo. Use for all TypeScript implementation work including core library (@textscene/core), VS Code extension, and web previewer. Covers feature implementation, debugging, testing, and integration across the stack.
---

# TextScene Inspector development

This skill orients you in the monorepo. AGENTS.md holds the gates and conventions, and the `implement-feature` skill holds the per-feature checklist.

- `packages/textscene-core`: the core library (`@textscene/core`): TSCN parsing, linting and react-three-fiber rendering.
- `apps/textscene-vscode`: the VS Code preview extension.
- `apps/textscene-web`: the Vite web previewer, for debugging.

## Core library

### Vertical slices

Each TSCN node type has its own folder, grouped by category (for example `2d`, `3d`, `physics`):

```
packages/textscene-core/src/nodes/[category]/[nodetype]/
├── parser.ts            # Parse TSCN properties (lenient, for rendering)
├── Component.tsx        # react-three-fiber component that renders the node
├── linterParser.ts      # Strict parsing for the linter
├── linter.ts            # Semantic lint rules
├── propertyFormatter.ts # Format properties for UI display (optional)
├── types.ts             # TypeScript type definitions
├── comparison.md        # Godot-parity sheet
├── index.ts             # Parser/formatter registration with NodeRegistry
├── index.r3f.ts         # Component registration with nodeComponentRegistry
├── index.linter.ts      # Linter registration (imports linterParser + linter)
└── *.test.ts(x)         # Co-located tests
```

Resources follow the Resource slice pattern (ADR-0031):
```
packages/textscene-core/src/resources/meshes/[meshtype]/
packages/textscene-core/src/resources/materials/[materialtype]/
```

### Add a node type

The **`implement-feature`** skill has the complete layer checklist: the scaffolder, the two linter layers, fixture-catalog regeneration, docs, golden images, the conformance guards and the resource slice shape. The steps below are the essentials for a node type, with DirectionalLight3D as the example.

1. **Research** with the `tscn-threejs-docs-researcher` agent:
   - The Godot node's properties and inheritance.
   - The matching three.js class and API.
   - The property mappings and format conversions.

2. **Scaffold the slice** with `pnpm new:node DirectionalLight3D 3d/lights --intent draws --linter`.

3. **Implement the parser** (`parser.ts`):
   - Parse the TSCN heading `[node type="DirectionalLight3D" ...]`.
   - Extract the properties with their type conversions.
   - Name the function `parseDirectionalLight3D()`.

4. **Implement the component** (`Component.tsx`):
   - Build a react-three-fiber component (for example `<directionalLight>`).
   - Apply the properties with their conversions.
   - Name the component after the node type: `DirectionalLight3D`.

5. **Register the node type** in three entry points:
   ```typescript
   // index.ts: parser + optional formatter
   import { nodeRegistry } from '../../../../core/NodeRegistry';
   import { parseDirectionalLight3D } from './parser';

   nodeRegistry.register({
     typeName: 'DirectionalLight3D',
     parser: parseDirectionalLight3D,
   });
   ```
   ```typescript
   // index.r3f.ts: R3F component
   import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
   import { DirectionalLight3D } from './Component';

   nodeComponentRegistry.register({ typeName: 'DirectionalLight3D', Component: DirectionalLight3D });
   ```
   ```typescript
   // index.linter.ts: linter registrations (side-effect imports only)
   import './linterParser.js';
   import './linter.js';
   ```
   The side-effect imports in the barrels (the scaffolder writes them):
   - `parser/TscnParser.ts`: `import '../nodes/3d/lights/directionallight3d/index.js';`
   - `r3f/nodes/index.ts`: `import '../../nodes/3d/lights/directionallight3d/index.r3f';`
   - `linter/index.ts`: `import '../nodes/3d/lights/directionallight3d/index.linter.js';`

   Never import a node's `index.ts` from `linter/index.ts`: that keeps the linter bundle free of THREE.js.

6. **Write the tests** (`*.test.ts`, `*.test.tsx`):
   - The parser, with different property combinations.
   - The component, with `@react-three/test-renderer`.
   - Edge cases and defaults.

7. **Run the gates** listed in AGENTS.md.

### Common patterns

Property names: Godot uses `snake_case`, three.js uses `camelCase`, and the names often differ (`light_energy` in Godot is `intensity` in three.js).

Type conversions:
- **Colours**: `Color(r, g, b, a)` → `new THREE.Color(r, g, b)`. `THREE.Color` has no alpha.
- **Vectors**: `Vector3(x, y, z)` → `new THREE.Vector3(x, y, z)`.
- **Transforms**: Godot stores a Basis as three rows (`Vector3 rows[3]`), so the parsed `basis_x`, `basis_y` and `basis_z` are rows, not columns. `THREE.Matrix4.elements` is column-major. `decomposeTransform3D` in `utils/transform.ts` turns a Transform3D into position, XYZ Euler rotation and scale.
- **Angles**: a property Godot stores in degrees becomes radians in three.js (multiply by `Math.PI / 180`).

Utilities:
- `utils/colorParser.ts`: parses the Godot Color format.
- `utils/transform.ts`: parses and decomposes a Transform3D.
- `r3f/lightConstants.ts`: light constants (render side only).
- `utils/nodePath.ts`: scene-tree node path helpers.
- `src/godot/`: engine facts (constants, tolerances, grammar). Look there before you declare a constant.

### Troubleshooting

**Parser**
- Check the TSCN documentation for the exact property format.
- A property can be in a `sub_resource` block, not in the node heading.
- Use the canonical value parsers (`parser/valueParsers.ts`) for complex values (Vector3, Color, and so on).

**Component**
- Check that the three.js property names match the documentation. R3F props mirror three.js.
- Confirm mappings with the `tscn-threejs-docs-researcher` agent.
- Some Godot properties have no direct three.js counterpart.
- Check coordinate conversions: both use Y-up, but transforms can differ.

**Visual differences**
- Lighting, materials and post-processing differ from Godot.
- Get the structure right first, then the visual parity.
- `pnpm ref:godot` measures the Godot side (AGENTS.md).

### TSCN format

The format is heading-based: `[type key=value ...]`. It has three main parts:
- `[node ...]`: scene tree nodes.
- `[ext_resource ...]`: references to external files.
- `[sub_resource ...]`: embedded data such as meshes, materials and shaders.

**Godot 4.x documentation:**
https://docs.godotengine.org/en/4.4/contributing/development/file_formats/tscn.html

## VS Code extension

### Structure

```
apps/textscene-vscode/src/
├── extension.ts             # Entry point: commands, language providers, diagnostics
├── TscnPreviewPanel.ts      # Webview panel lifecycle + messaging
├── TscnDiagnostics.ts       # Linter-backed diagnostics
├── protocol.ts              # Extension <-> webview message types
├── providers/               # VSCodeResourceProvider (resource loading)
└── webview/                 # Webview UI using @textscene/core
    ├── r3f-webview-main.tsx # React entry mounted in the webview
    ├── webviewHtml.ts       # HTML shell + CSP
    └── WebviewResourceProvider.ts
```

### Preview panel

1. `extension.ts` registers the `textscene.openPreviewToSide` command.
2. `TscnPreviewPanel.create()` builds one `vscode.WebviewPanel` per `.tscn` file.
3. The extension and the React webview exchange messages in both directions. `protocol.ts` types them.

**Extension → webview:**
```typescript
panel.webview.postMessage({
  type: 'loadTscn',
  content: tscnFileContent
});
```

**Webview → extension:**
```typescript
vscode.postMessage({
  type: 'error',
  message: 'Failed to parse scene'
});
```

### Workflow

```bash
cd apps/textscene-vscode

# Development (watch mode)
pnpm dev

# Build and package
pnpm build && pnpm package

# Install for testing
code --install-extension textscene-inspector-*.vsix
```

## Web previewer

The web previewer is a Vite app for fast testing and debugging of `@textscene/core`.

### Structure

```
apps/textscene-web/src/
├── main.ts           # Entry point (mounts the React app)
├── r3f-main.tsx      # App shell: fixture picker, uploads, <TscnPreviewShell>
├── fixtures.ts       # Generated fixture catalog (pnpm generate:fixtures)
└── logger.ts         # Log adapter wiring
```

### Use of the core library

```tsx
// Parsing with @textscene/core
import { TscnParser, TscnPreviewShell } from '@textscene/core';

const parser = new TscnParser();
const scene = parser.parse(tscnContent); // lenient: recovers from bad input

// Rendering is react-three-fiber components, with no imperative renderer
// class. <TscnPreviewShell> parses `content` itself and renders the full
// viewer (canvas, scene tree, details, missing-resources panel):
<TscnPreviewShell panelId="my-panel" content={tscnContent} />
```

### Workflow

```bash
cd apps/textscene-web

# Development server (hot reload)
pnpm dev  # http://localhost:5173

# Build and preview production
pnpm build
pnpm preview  # http://localhost:4173
```

### Test a core library change

The web app resolves `@textscene/core` from its `dist/`. Rebuild the core library first:
```bash
# Rebuild library
cd packages/textscene-core && pnpm build

# Then rebuild web app
cd ../../apps/textscene-web && pnpm build
```

## Integration and testing

From the project root:
```bash
pnpm install         # Install/update dependencies
pnpm type-check      # TypeScript validation across all packages
pnpm lint            # ESLint across all packages
pnpm lint:fix        # Auto-fix linting issues
pnpm test            # Run all unit tests (Vitest)
pnpm build           # Build all packages in dependency order
```

AGENTS.md lists the full gates.

For browser tests, use the `e2e-testing` skill:
- Web previewer: file upload to rendering.
- VS Code extension: file open to custom editor to rendering.
- Visual regression with screenshots.

## Principles

**KISS and DRY**
- Keep implementations simple, and avoid premature abstraction.
- Extract a utility at the third clear duplication (Rule of Three).
- Keep single-use code inline until duplication appears.

**Fast iteration**
- Use the web previewer for fast visual feedback.
- Co-locate tests with the implementation.

**Self-registration**
- Node types register through NodeRegistry (parsing), nodeComponentRegistry (rendering) and the linter registries.
- A new node type needs one new line in each of the three side-effect import barrels, and no conditional or switch statement.

**Feature parity**
- Keep the web previewer and the VS Code extension at the same function.
- Both use the same `@textscene/core` library, so every feature works in both apps.

## Context7 documentation

Use the Context7 MCP tool for current documentation:

- **three.js**: `/mrdoob/three.js`
- **Godot Engine**: `websites/godotengine_en_stable`
- **VS Code Extension API**: `/websites/code_visualstudio_api`
- **TypeScript**: `microsoft/typescript`
- **Vitest**: `websites/vitest_dev`
- **pnpm**: `pnpm/pnpm`

[REFERENCES.md](../../../REFERENCES.md) has the links and more documentation.

## When to use this skill

Use this skill for:
- ✅ New TSCN node types or sub-resources.
- ✅ Features in the core library.
- ✅ VS Code extension features.
- ✅ Debugging rendering in the web previewer.
- ✅ Refactoring existing code.
- ✅ Utilities and shared functions.
- ✅ Integration across packages.
- ✅ TypeScript work in the monorepo.

Use other skills and agents for:
- 🔬 **tscn-threejs-docs-researcher agent**: documentation research for Godot and three.js APIs.
- 🧪 **e2e-testing skill**: end-to-end browser tests.
- 🏗️ **codebase-architect agent**: architecture analysis and refactoring plans.
