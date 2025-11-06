# Architecture

## Technology Stack

- TypeScript (strict mode)
- pnpm workspaces
- Vitest 3.2+ (projects feature)
- three.js
- Vite (web app)

## Project Structure

```
/
├── packages/
│   └── tscn-renderer/      # Core library
│       └── src/
│           ├── parser/     # TSCN parsing
│           ├── nodes/      # Vertical slices per node type
│           │   ├── node3d/
│           │   │   ├── parser.ts        # Parse logic
│           │   │   ├── renderer.ts      # Render logic
│           │   │   ├── index.ts         # Self-registration
│           │   │   └── node3d.test.ts   # Co-located tests
│           │   └── meshinstance3d/
│           ├── core/       # Core systems
│           │   ├── NodeRegistry.ts       # Self-registering node types
│           │   ├── SceneManager.ts       # External scene lifecycle & hot-reload
│           │   ├── NodeLifecycleManager.ts  # Node add/remove/update
│           │   ├── SceneSetup.ts         # Three.js initialization
│           │   └── TscnRenderer.ts       # Main renderer
│           ├── resources/  # Resource handling
│           │   ├── resourceResolver.ts  # Generic resolution
│           │   ├── ResourceManager.ts   # Mesh/material loading
│           │   ├── meshes/              # Mesh sub-resources
│           │   └── materials/           # Material sub-resources
│           └── ui/         # UI components
│               ├── TscnPreviewUI.ts     # Main UI coordinator
│               ├── SceneTreeViewer.ts   # Tree hierarchy
│               └── NodeDetailsFormatter.ts  # Property display
├── apps/
│   ├── vscode-extension/   # VS Code extension (shares textscene-renderer)
│   ├── web-previewer/      # Web dev/debug tool (shares textscene-renderer)
│   └── powertoys/          # Future
└── tests/                  # Shared test utilities & fixtures
```

## Key Concepts

### Vertical Slicing

Each TSCN node type (Mesh, Camera, Light, etc.) has its own folder containing:
- `parser.ts` - Type guards and property parsing
- `renderer.ts` - Three.js object creation
- `index.ts` - Self-registration with NodeRegistry
- `*.test.ts` - Co-located unit tests

Related code stays together for easy iteration. No central files need editing when adding node types.

### Node Registry Pattern

**Problem**: Adding new node types required editing TscnParser and TscnRenderer (violates Open/Closed Principle)

**Solution**: Self-registering node types via NodeRegistry
- Each node type registers itself on import
- Parser/renderer use registry lookup instead of conditionals
- Adding new nodes: create folder + import in TscnParser.ts

**Benefits**:
- 75% reduction in maintenance overhead
- No hardcoded switch statements
- Type-safe registration
- Automatic parser and renderer wiring

### Generic Resource Resolution

`resolveResource<T>()` generic function eliminates duplication in resolveGeometry() and resolveMaterial():
- Type-safe handler registration (parser + renderer per resource type)
- Single error handling path
- Eliminates 75 lines of duplicated code

### Scene Management Architecture

**Problem**: External scene instances (PackedScene) needed proper lifecycle management, hot-reload support, and instance tracking without code duplication.

**Solution**: Four-layer architecture with clear separation of concerns and DRY principles.

---

**Layer 1: ResourceRegistry** - Generic resource loading (textures, scenes, materials), file caching, circular dependency detection

**Layer 2: SceneManager** - External scene loading/caching, instance tracking (`Map<scenePath, Set<instancePath>>`), hot-reload via `updateScene()`

**Layer 3: NodeLifecycleManager** - Node add/remove/update operations, delegates instance handling to SceneManager

**Layer 4: UI Layer** - SceneTreeViewer, SelectionManager, visual indicators for instance nodes

**Hot-reload**: `updateScene()` clears caches, reloads scene, removes old children, re-adds updated nodes to all instances

**Circular dependency**: Setter-based initialization (`setNodeLifecycleManager()`, `setSceneManager()`) avoids constructor complexity

### UI Composition

- `TscnPreviewUI` - Event wiring, state management
- `SceneTreeViewer` - DOM manipulation, tree logic
- `NodeDetailsFormatter` - Pure HTML generation
- `SceneSetup` - Three.js initialization

Both apps (web-previewer and vscode-extension) share same rendering engine, UI components, and functionality via textscene-renderer package.

### TSCN Format

Heading-based text format: `[type key=value ...]`

Components:
- Nodes (scene tree)
- External resources (file references)
- Internal resources (embedded data)

**Single Root Rule**: Every TSCN file must have exactly one root node. Parser enforces this constraint.
