---
name: textscene-dev
description: Full-stack development for TextScene Inspector monorepo. Use for all TypeScript implementation work including core library (tscn-renderer), VS Code extension, and web previewer. Covers feature implementation, debugging, testing, and integration across the stack.
---

# TextScene Inspector Development

**Monorepo Stack:**
- `packages/textscene-renderer` - Core library using three.js
- `apps/textscene-vscode` - VS Code custom editor extension
- `apps/textscene-web` - Vite-based web previewer for debugging

## Core Library Development

### Vertical Slicing Pattern

Each TSCN node type gets its own self-contained folder:

```
packages/textscene-renderer/src/nodes/[nodetype]/
├── parser.ts           # Parse TSCN properties
├── renderer.ts         # Create three.js objects
├── propertyFormatter.ts # Format properties for UI display (optional)
├── types.ts            # TypeScript type definitions
├── index.ts            # Self-registration with NodeRegistry
└── [nodetype].test.ts  # Co-located tests
```

**Same pattern for resources:**
```
packages/textscene-renderer/src/resources/meshes/[meshtype]/
packages/textscene-renderer/src/resources/materials/[materialtype]/
```

### Adding a New Node Type

**Example: Adding DirectionalLight3D support**

1. **Research Phase** - Use `tscn-threejs-docs-researcher` agent:
   - Look up Godot documentation for node properties and inheritance
   - Find corresponding three.js class and API
   - Identify property mappings and format conversions

2. **Create Folder Structure**
   ```bash
   mkdir packages/textscene-renderer/src/nodes/directionallight3d
   ```

3. **Implement Parser** (`parser.ts`)
   - Parse TSCN heading: `[node type="DirectionalLight3D" ...]`
   - Extract properties with type conversions
   - Follow naming: `isDirectionalLight3D()`, `parseDirectionalLight3D()`

4. **Implement Renderer** (`renderer.ts`)
   - Create THREE.js object (e.g., `THREE.DirectionalLight`)
   - Apply properties with conversions
   - Follow naming: `createDirectionalLight3D()`

5. **Register Node Type** (`index.ts`)
   ```typescript
   import { nodeRegistry } from '../../core/NodeRegistry';
   import { isDirectionalLight3D, parseDirectionalLight3D } from './parser';
   import { createDirectionalLight3D } from './renderer';

   nodeRegistry.register({
     typeName: 'DirectionalLight3D',
     typeGuard: isDirectionalLight3D,
     parser: parseDirectionalLight3D,
     renderer: createDirectionalLight3D,
   });
   ```
   Then import in `TscnParser.ts`: `import '../nodes/directionallight3d';`

6. **Write Tests** (`*.test.ts`)
   - Test parser with various property combinations
   - Test renderer creates correct three.js objects
   - Test edge cases and defaults

7. **Validation Workflow**
   ```bash
   cd packages/textscene-renderer
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
- `resources/resourceResolver.ts` - Generic resource resolution pattern

### Troubleshooting

**Parser Issues:**
- Check TSCN docs for exact property format
- Properties may be in `sub_resource` blocks, not node headings
- Use regex for complex values (Vector3, Color, etc.)

**Renderer Issues:**
- Verify three.js property names match documentation
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
├── extension.ts        # Entry point, register custom editor
├── editor/
│   ├── provider.ts     # CustomEditorProvider implementation
│   └── webview.ts      # Webview setup and messaging
└── webview/            # Webview UI using tscn-renderer library
```

### Custom Editor Pattern

1. Register in `extension.ts`: `vscode.window.registerCustomEditorProvider()`
2. Implement `CustomReadonlyEditorProvider` in `editor/provider.ts`
3. Setup webview in `editor/webview.ts` with bidirectional message passing

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
code --install-extension tscn-previewer-*.vsix
```

---

## Web Previewer Development

### Purpose

Vite-based web app for rapid testing and debugging of the tscn-renderer library.

### Architecture

```
apps/textscene-web/src/
├── main.ts           # Entry point
├── renderer.ts       # three.js scene setup using tscn-renderer
├── fileUpload.ts     # File upload UI
└── ui/               # UI components
```

### Implementation Pattern

```typescript
// File upload handling
input.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  const content = await file.text();
  await loadScene(content);
});

// Scene rendering with tscn-renderer library
import { TscnParser, TscnRenderer } from 'tscn-renderer';

async function loadScene(tscnContent: string) {
  const parsed = TscnParser.parse(tscnContent);
  const scene = TscnRenderer.render(parsed);
  threeScene.add(scene);
}
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
cd packages/textscene-renderer && pnpm build

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
- New node types register themselves via NodeRegistry
- No central files need editing when adding features
- Eliminates hardcoded conditionals and switch statements

### Feature Parity
- Keep web-previewer and vscode-extension functionality in sync
- Both use the same tscn-renderer library
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
