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
│           │   ├── NodeRegistry.ts      # Self-registering node types
│           │   ├── SceneSetup.ts        # Three.js initialization
│           │   └── TscnRenderer.ts      # Main renderer
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

**Problem**: Duplicated try-catch and error handling in resolveGeometry() and resolveMaterial()

**Solution**: `resolveResource<T>()` generic function
- Type-safe handler registration (parser + renderer per resource type)
- Single error handling path
- Eliminates 75 lines of duplicated code

**Usage**:
```typescript
const meshHandlers: ResourceTypeMap<THREE.BufferGeometry> = {
  BoxMesh: { parser: parseBoxMesh, renderer: createBoxMeshGeometry },
  // ... more mesh types
};
resolveResource(meshRef, scene, meshHandlers, 'mesh');
```

### UI Composition Pattern

**Components**:
- `TscnPreviewUI` - Coordinates canvas, tree viewer, details panel
- `SceneTreeViewer` - Renders interactive node hierarchy
- `NodeDetailsFormatter` - Generates property display HTML
- `SceneSetup` - Initializes three.js scene/camera/renderer

**Separation of concerns**:
- TscnPreviewUI: Event wiring and state management
- SceneTreeViewer: DOM manipulation and tree logic
- NodeDetailsFormatter: Pure HTML generation (no DOM access)
- SceneSetup: Three.js initialization (no UI coupling)

### Feature Parity

Both apps (web-previewer and vscode-extension) share:
- Same rendering engine (TscnRenderer)
- Same UI components (TscnPreviewUI, SceneTreeViewer)
- Same tree viewer styles and functionality
- Same node details formatting

Achieved by extracting all functionality to textscene-renderer package.

### TSCN Format

Heading-based text format: `[type key=value ...]`

Components:
- Nodes (scene tree)
- External resources (file references)
- Internal resources (embedded data)

**Single Root Rule**: Every TSCN file must have exactly one root node. Parser enforces this constraint.
