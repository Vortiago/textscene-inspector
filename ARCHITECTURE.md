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

### Shared Light Utilities

**Location**: `packages/textscene-core/src/nodes/3d/lights/shared/`

Light nodes (DirectionalLight3D, OmniLight3D, SpotLight3D) share common properties and formatting logic. Shared utilities eliminate ~105 lines of duplication:

**Parser Utilities** (`shared/parser.ts`):
- `parseBaseLightProperties()` - Parses light_color, light_energy, shadow_enabled, shadow_bias, shadow_filter
- `parseBaseLightWithNormalBias()` - Extends base properties with shadow_normal_bias (for DirectionalLight3D, OmniLight3D)

**Formatter Utilities** (`shared/propertyFormatter.ts`):
- `formatBaseLightSection()` - Formats Light section (Color, Energy + optional items)
- `formatBaseShadowSection()` - Formats Shadow section (Enabled, Bias, Filter + optional items)
- `formatShadowSectionWithNormalBias()` - Extends base shadow section with Normal Bias

**Type Definitions** (`shared/types.ts`):
- `BaseLightProperties` - Common light properties interface
- `BaseLightWithNormalBias` - Extended interface with shadow_normal_bias

**Benefits**:
- Light-specific parsers/formatters reduced to ~10-15 lines
- New light types easier to implement
- Consistent property handling across all lights
- Type-safe property inheritance

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

### GLB/GLTF Instance Pattern

**Problem**: GLB/GLTF files are binary mesh formats that need proper instancing support, material cloning, and Godot "editable instance" feature for material overrides.

**Solution**: Three-phase architecture in ResourceRegistry, NodeLifecycleManager, and Material cloning.

---

**Phase 1: Resource Loading** (ResourceRegistry.loadGLBMesh)
- Loads binary GLB/GLTF files via GLTFLoader
- Caches parsed three.js scene graphs
- **Critical**: Returns cloned instances (not cached reference)

```typescript
// Each call returns a NEW clone
const mesh1 = await loadGLBMesh('door_glb');
const mesh2 = await loadGLBMesh('door_glb');
// mesh1 !== mesh2 (different instances)
```

**Phase 2: Material Cloning** (THREE.Object3D.clone(true))
- `clone(true)` clones geometry AND materials
- Prevents material sharing between instances
- Allows independent material overrides per instance

**Why Material Cloning Is Required**:
THREE.Object3D can only have ONE parent in the scene graph. When caching GLB meshes:

- ❌ Without cloning: Only last instance renders (previous instances lose parent)
- ✅ With cloning: Each instance is independent, all render correctly

Additionally, materials must be cloned to support per-instance material overrides without affecting other instances.

**Phase 3: Editable Instance Support** (NodeLifecycleManager)
- Godot's "editable instance" feature allows modifying children inside binary meshes
- Children with `index` attribute refer to GLB children by array index
- Supports `surface_material_override/N` properties per-child

```typescript
// Parent node with instance = "door.glb"
{
  name: 'DoorInstance',
  instance: 'ExtResource("door_glb")',
  children: [
    {
      name: 'Handle', // Editable child
      properties: {
        index: 2, // Child at index 2 in GLB
        'surface_material_override/0': 'ExtResource("gold_mat")'
      }
    }
  ]
}
```

**Material Override Flow**:
1. Load GLB mesh from cache (cloned)
2. Identify editable children (those with `index` attribute)
3. Find corresponding child in GLB by index
4. Parse `surface_material_override/N` properties
5. Apply overrides via `applyMaterialOverridesToMesh()` (traverses mesh hierarchy)

**Implementation Details**:
- Material array mutation: Converting single Material → array requires cloning to avoid cache corruption
- Transform overrides: Godot Transform3D applied to GLB children (sets matrix, disables matrixAutoUpdate)
- Non-indexed children: Added as new children to instance (not editable instance feature)

**Benefits**:
- Multiple GLB instances render independently
- Material modifications isolated per-instance
- Godot scene format compatibility
- Cache efficiency (load once, clone many)

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
