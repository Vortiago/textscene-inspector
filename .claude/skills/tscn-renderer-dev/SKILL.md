---
name: tscn-renderer-dev
description: Implement TSCN node parsers and three.js renderers for Godot scene files. Use when adding new node types, debugging rendering issues, running tests, or working with .tscn files in packages/textscene-renderer.
---

# TSCN Renderer Development

Core library: `packages/textscene-renderer`

## Vertical Slicing Pattern

Each TSCN node type gets its own folder:

```
src/nodes/mesh/
├── parser.ts      # Parse TSCN data
├── renderer.ts    # Create three.js objects
└── mesh.test.ts   # Co-located tests
```

## Adding a Node Type

Example: Adding DirectionalLight support

1. Create `src/nodes/directional-light/`
2. Implement `parser.ts` - parse TSCN heading: `[node type="DirectionalLight" ...]`
3. Implement `renderer.ts` - create `THREE.DirectionalLight` and apply properties
4. Write tests in `*.test.ts`
5. Run validation:

```bash
cd packages/textscene-renderer
pnpm type-check && pnpm lint:fix && pnpm test && pnpm build
```

## Research Phase

Before implementing a new node type, use the **tscn-threejs-docs-researcher agent** to:
- Look up Godot documentation for the node type's properties and inheritance hierarchy
- Find the corresponding three.js class and its constructor/API
- Identify property mappings and format conversions needed
- Understand any Godot-specific behaviors that need translation

Example invocation:
> "Use tscn-threejs-docs-researcher to research DirectionalLight3D properties and the three.js DirectionalLight API"

## Common Patterns

### Property Naming Conventions
- Godot uses `snake_case`, three.js uses `camelCase`
- Example: `light_energy` (Godot) → `intensity` (three.js)

### Type Conversions
- **Colors**: `Color(r, g, b, a)` → `new THREE.Color(r, g, b)` (note: three.js doesn't use alpha in Color)
- **Vectors**: `Vector3(x, y, z)` → `new THREE.Vector3(x, y, z)`
- **Transforms**: Godot uses column-major, three.js uses row-major matrices
- **Angles**: Godot uses degrees, three.js uses radians (multiply by Math.PI / 180)

### Parser Pattern
```typescript
export function parseNodeType(heading: TscnHeading): NodeTypeData {
  return {
    type: heading.type,
    name: heading.name,
    properties: extractProperties(heading),
    // Extract sub_resources if needed
  };
}
```

### Renderer Pattern
```typescript
export function renderNodeType(data: NodeTypeData): THREE.Object3D {
  const object = new THREE.NodeTypeClass();
  
  // Apply properties with conversions
  if (data.properties.some_property) {
    object.someProperty = convertValue(data.properties.some_property);
  }
  
  return object;
}
```

## Troubleshooting

### Parser Issues

**Issue**: Parser fails on property format
**Fix**: Check TSCN docs for exact format. Properties may be nested in `sub_resource` blocks rather than directly in the node heading.

**Issue**: Can't parse complex property values
**Fix**: TSCN uses Godot's serialization format. Vectors look like `Vector3(1, 2, 3)`, Colors like `Color(1, 0, 0, 1)`. Use regex or custom parsers for these.

### Renderer Issues

**Issue**: Renderer creates object but properties don't apply
**Fix**: Verify three.js property names match documentation. Use tscn-threejs-docs-researcher agent to confirm. Some Godot properties don't have direct three.js equivalents.

**Issue**: Object appears but in wrong position/rotation
**Fix**: Check coordinate system conversions. Godot uses Y-up, three.js uses Y-up but may need transform adjustments for imported assets.

**Issue**: Visual output doesn't match Godot editor
**Fix**: Lighting, materials, and post-processing differ. Focus on structural correctness first, visual parity second.

### Testing Issues

**Issue**: Tests pass but rendering looks wrong in web previewer
**Fix**: Use **e2e-test-orchestrator agent** to validate visual output in browser with actual TSCN files.

**Issue**: Can't create test TSCN files
**Fix**: Export from Godot editor or create minimal TSCN manually following the format in TSCN Format section below.

## Validation Workflow

After implementation:

1. **Unit tests**: Verify parser and renderer in isolation
2. **Build validation**: Run type-check, lint, test, build
3. **Visual validation**: Use **e2e-test-orchestrator agent** to test in web previewer with real TSCN files

## TSCN Format

Heading-based format: `[type key=value ...]`

- `[node ...]` - Scene tree nodes
- `[ext_resource ...]` - External file references
- `[sub_resource ...]` - Embedded data

Doc: https://docs.godotengine.org/en/4.4/contributing/development/file_formats/tscn.html

## Development Principles

- **KISS**: Keep implementations simple, avoid over-engineering
- **DRY**: Don't repeat yourself, but avoid premature abstraction
- **Iterative**: Build working code first, refine later
- **No documentation**: Don't create README files or excessive comments - code should be self-explanatory

## Context7 Docs

- three.js: `/mrdoob/three.js`
- Godot: `websites/godotengine_en_stable`
- TypeScript: `microsoft/typescript`
- Vitest: `websites/vitest_dev`
