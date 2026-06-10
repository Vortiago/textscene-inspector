---
name: textscene-dev
description: Full-stack development for TextScene Inspector monorepo. Use for all TypeScript implementation work including core library (@textscene/core), VS Code extension, and web previewer. Covers feature implementation, debugging, testing, and integration across the stack.
---

# TextScene Inspector Development

**Monorepo Stack:**
- `packages/textscene-core` - Core library (`@textscene/core`): TSCN parsing, linting, and react-three-fiber rendering
- `apps/textscene-vscode` - VS Code preview extension
- `apps/textscene-web` - Vite-based web previewer for debugging

## Core Library Development

### Vertical Slicing Pattern

Each TSCN node type gets its own self-contained folder (categories: `2d`, `3d`, `animation`, `audio`, `base`, `node`, `paths`, `physics`):

```
packages/textscene-core/src/nodes/[category]/[nodetype]/
├── parser.ts            # Parse TSCN properties (lenient, for rendering)
├── Component.tsx        # react-three-fiber component that renders the node
├── linterParser.ts      # Strict parsing for the linter
├── linter.ts            # Semantic lint rules
├── propertyFormatter.ts # Format properties for UI display (optional)
├── types.ts             # TypeScript type definitions
├── index.ts             # Parser/formatter registration with NodeRegistry
├── index.r3f.ts         # Component registration with nodeComponentRegistry
├── index.linter.ts      # Linter registration (imports linterParser + linter)
└── *.test.ts(x)         # Co-located tests
```

**Same pattern for resources:**
```
packages/textscene-core/src/resources/meshes/[meshtype]/
packages/textscene-core/src/resources/materials/[materialtype]/
```

### Adding a New Node Type

**Example: Adding DirectionalLight3D support**

1. **Research Phase** - Use `tscn-threejs-docs-researcher` agent:
   - Look up Godot documentation for node properties and inheritance
   - Find corresponding three.js class and API
   - Identify property mappings and format conversions

2. **Create Folder Structure**
   ```bash
   mkdir packages/textscene-core/src/nodes/3d/lights/directionallight3d
   ```

3. **Implement Parser** (`parser.ts`)
   - Parse TSCN heading: `[node type="DirectionalLight3D" ...]`
   - Extract properties with type conversions
   - Follow naming: `parseDirectionalLight3D()`

4. **Implement Component** (`Component.tsx`)
   - Build a react-three-fiber component (e.g., `<directionalLight>`)
   - Apply properties with conversions
   - Name the component after the node type: `DirectionalLight3D`

5. **Register Node Type** (three entry points)
   ```typescript
   // index.ts — parser + optional formatter
   import { nodeRegistry } from '../../../../core/NodeRegistry';
   import { parseDirectionalLight3D } from './parser';

   nodeRegistry.register({
     typeName: 'DirectionalLight3D',
     parser: parseDirectionalLight3D,
   });
   ```
   ```typescript
   // index.r3f.ts — R3F component
   import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
   import { DirectionalLight3D } from './Component';

   nodeComponentRegistry.register({ typeName: 'DirectionalLight3D', Component: DirectionalLight3D });
   ```
   ```typescript
   // index.linter.ts — linter registrations (side-effect imports only)
   import './linterParser.js';
   import './linter.js';
   ```
   Then wire the side-effect imports:
   - `parser/TscnParser.ts`: `import '../nodes/3d/lights/directionallight3d/index.js';`
   - `r3f/nodes/index.ts`: `import '../../nodes/3d/lights/directionallight3d/index.r3f';`
   - `linter/index.ts`: `import '../nodes/3d/lights/directionallight3d/index.linter.js';`
     (keeps the linter bundle free of THREE.js — never import a node's `index.ts` there)

6. **Write Tests** (`*.test.ts` / `*.test.tsx`)
   - Test parser with various property combinations
   - Test the component with `@react-three/test-renderer`
   - Test edge cases and defaults

7. **Validation Workflow**
   ```bash
   cd packages/textscene-core
   pnpm type-check && pnpm lint:fix && pnpm test && pnpm build
   ```

### Common Patterns

#### Property Naming Conventions
- Godot: `snake_case` → three.js: `camelCase`
- Example: `light_energy` (Godot) → `intensity` (three.js)

#### Type Conversions
- **Colors**: `Color(r, g, b, a)` → `new THREE.Color(r, g, b)` (three.js ignores alpha)
- **Vectors**: `Vector3(x, y, z)` → `new THREE.Vector3(x, y, z)`
- **Transforms**: Godot uses column-major, three.js uses row-major matrices
- **Angles**: Godot degrees → three.js radians (multiply by `Math.PI / 180`)

#### Utilities Available
- `utils/colorParser.ts` - Parse Godot Color format
- `utils/transform.ts` - Transform matrix conversions
- `utils/lightConstants.ts` - Light-related constants
- `utils/shadowUtils.ts` - Shadow configuration helpers
- `utils/lightTargetUtils.ts` - Light target positioning
- `utils/nodePath.ts` - Scene-tree node path helpers

### Troubleshooting

**Parser Issues:**
- Check TSCN docs for exact property format
- Properties may be in `sub_resource` blocks, not node headings
- Use regex for complex values (Vector3, Color, etc.)

**Component Issues:**
- Verify three.js property names match documentation (R3F props mirror three.js)
- Use `tscn-threejs-docs-researcher` agent to confirm mappings
- Some Godot properties don't have direct three.js equivalents
- Check coordinate system conversions (both use Y-up but transforms may differ)

**Visual Differences:**
- Lighting, materials, post-processing differ from Godot
- Focus on structural correctness first, visual parity second

### TSCN Format Reference

Heading-based format: `[type key=value ...]`

Three main components:
- `[node ...]` - Scene tree nodes
- `[ext_resource ...]` - External file references
- `[sub_resource ...]` - Embedded data like meshes, materials, shaders

**Godot 4.x Documentation:**
https://docs.godotengine.org/en/4.4/contributing/development/file_formats/tscn.html

---

## VS Code Extension Development

### Architecture

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

### Preview Panel Pattern

1. `extension.ts` registers the `textscene.openPreviewToSide` command
2. `TscnPreviewPanel.create()` builds one `vscode.WebviewPanel` per .tscn file
3. Bidirectional message passing (typed in `protocol.ts`) between the extension and the React webview

### Message Passing

**Extension → Webview:**
```typescript
panel.webview.postMessage({
  type: 'loadScene',
  content: tscnFileContent
});
```

**Webview → Extension:**
```typescript
vscode.postMessage({
  type: 'error',
  message: 'Failed to parse scene'
});
```

### Development Workflow

```bash
cd apps/textscene-vscode

# Development (watch mode)
pnpm dev

# Full validation and packaging
pnpm type-check && pnpm lint:fix && pnpm test && pnpm build && pnpm package

# Install for testing
code --install-extension textscene-inspector-*.vsix
```

---

## Web Previewer Development

### Purpose

Vite-based web app for rapid testing and debugging of the @textscene/core library.

### Architecture

```
apps/textscene-web/src/
├── main.ts           # Entry point (mounts the React app)
├── r3f-main.tsx      # App shell: fixture picker, uploads, <TscnPreviewShell>
├── fixtures.ts       # Generated fixture catalog (pnpm generate:fixtures)
└── logger.ts         # Log adapter wiring
```

### Implementation Pattern

```tsx
// Parsing with @textscene/core
import { TscnParser, TscnPreviewShell } from '@textscene/core';

const parser = new TscnParser();
const scene = parser.parse(tscnContent); // lenient: recovers from bad input

// Rendering is react-three-fiber components — there is no imperative
// renderer class. <TscnPreviewShell> parses `content` itself and renders
// the full viewer (canvas, scene tree, details, missing-resources panel):
<TscnPreviewShell panelId="my-panel" content={tscnContent} />
```

### Development Workflow

```bash
cd apps/textscene-web

# Development server (hot reload)
pnpm dev  # http://localhost:5173

# Build and preview production
pnpm type-check && pnpm lint:fix && pnpm build
pnpm preview  # http://localhost:4173
```

### Testing Library Changes

**IMPORTANT:** Always rebuild the core library first:
```bash
# Rebuild library
cd packages/textscene-core && pnpm build

# Then rebuild web app
cd ../../apps/textscene-web && pnpm build
```

---

## Integration & Testing

### Complete Build Validation

From project root:
```bash
pnpm install         # Install/update dependencies
pnpm type-check      # TypeScript validation across all packages
pnpm lint            # ESLint across all packages
pnpm lint:fix        # Auto-fix linting issues
pnpm test            # Run all unit tests (Vitest)
pnpm build           # Build all packages in dependency order
```

### End-to-End Testing

Use the `e2e-testing` skill for browser automation testing:
- Web previewer: File upload → rendering validation
- VS Code extension: File open → custom editor → rendering validation
- Visual regression testing with screenshots

---

## Development Principles

### KISS and DRY
- Keep implementations simple, avoid premature abstraction
- Extract utilities when you see clear duplication (Rule of Three)
- Use generic functions for repeated patterns (see `resourceResolver.ts`, `shadowUtils.ts`)
- Keep single-use code inline until duplication emerges

### Quick Iterations
- Prioritize working code over architectural perfection
- Use web previewer for rapid visual feedback
- Co-locate tests with implementation files

### Self-Registering Patterns
- New node types register themselves via NodeRegistry (parsing), nodeComponentRegistry (rendering), and the linter registries
- Only the three side-effect import barrels need a new line when adding a node type
- Eliminates hardcoded conditionals and switch statements

### Feature Parity
- Keep web-previewer and vscode-extension functionality in sync
- Both use the same @textscene/core library
- All features should work in both apps

---

## Context7 Documentation References

Use Context7 MCP tool for up-to-date documentation:

- **three.js**: `/mrdoob/three.js`
- **Godot Engine**: `websites/godotengine_en_stable`
- **VS Code Extension API**: `/websites/code_visualstudio_api`
- **TypeScript**: `microsoft/typescript`
- **Vitest**: `websites/vitest_dev`
- **pnpm**: `pnpm/pnpm`

See [REFERENCES.md](../../REFERENCES.md) for links and additional documentation.

---

## When to Use This Skill

**Use this skill for:**
- ✅ Implementing new TSCN node types or sub-resources
- ✅ Adding features to the core library
- ✅ Working on VS Code extension features
- ✅ Debugging rendering issues in the web previewer
- ✅ Refactoring or improving existing code
- ✅ Adding utilities or shared functionality
- ✅ Integration work across packages
- ✅ TypeScript development in the monorepo

**Use other skills/agents for:**
- 🔬 **tscn-threejs-docs-researcher agent**: Documentation research for Godot and three.js APIs
- 🧪 **e2e-testing skill**: End-to-end browser automation testing
- 🏗️ **codebase-architect agent**: Architecture analysis and refactoring planning
