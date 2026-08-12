# TSCN Scenes

`scenes/fixtures/` is a Godot `res://` root. Every `.tscn` the previewer offers
by default sits at its top level, and every resource those scenes reference
(`materials/`, `textures/`, `fonts/`) sits at the `res://` subpath the scene
names. The web previewer mirrors the directory verbatim into
`public/fixtures/`, the VS Code integration workspace mirrors it verbatim too,
and `pnpm ref:godot` stages it as the project root — so all three resolve
`res://` to the same bytes, exactly as opening the folder in VS Code does.

Other directories under `scenes/` are their own roots and are NOT part of that
namespace:

| Directory | What it is |
| --- | --- |
| `fixtures/` | The default corpus's `res://` root — unit, edge, integration and example scenes plus their resources |
| `upload-payloads/` | Files the `test-missing-*` fixtures deliberately CANNOT find. Kept out of every root so "missing" is true for Godot, the web previewer and VS Code alike; drag one into the previewer to watch a missing resource resolve |
| `isometric/` | Vendored dungeon corpus — its own unmarked root (`scripts/corpusRoots.mjs`) |
| `demos/<top>/<project>/` | Vendored godot-demo-projects, each with its own `project.godot` |
| `games/` | On-demand vendored games (gitignored, see below) |

## Open-source games corpus (on-demand)

Real community games (Kenney 3D Platformer, GDQuest Open RPG, lampe-games Open
RTS) can be vendored into `scenes/games/` to exercise the previewer against
full, real-world scene graphs. They are **fetched on demand, not committed**
(to keep the repo lean):

```bash
pnpm vendor:games   # shallow-fetch each game at a pinned commit + regenerate the manifest
```

This populates `scenes/games/` (gitignored) and writes
`apps/textscene-web/src/fixtures.games.ts` (gitignored). A fresh clone / CI has
no games until you run the command. The pinned sources, commits, and licenses
are listed in `scripts/vendor-godot-games.mjs`.

### Games are DEPLOY-ONLY, not local

Vendoring is for *verifying* against real scene graphs, so having done it must
not drop ~140 game scenes into your local scene selector. The corpus therefore
appears **only** in the deployed site:

| Command | Games |
| --- | --- |
| `pnpm dev`, `pnpm build` | excluded |
| `pnpm build:deploy` | **included** |

`build:deploy` (`scripts/build-deploy.mjs`) vendors the corpus and sets
`VITE_INCLUDE_GAMES=1`. Two consumers read that variable and must agree, or the
selector lists scenes whose files were never mirrored:
`apps/textscene-web/scripts/copy-fixtures.js` (the `public/fixtures/games/`
mirror) and `apps/textscene-web/src/fixturesAll.ts` (the manifest). A test pins
the default-excluded arm.

**Deploying:** point the Cloudflare Pages build command at `pnpm build:deploy`.
There is no `wrangler.toml` and the Pages deploy in `.github/workflows/ci.yml`
is commented out, so that build command lives in the Cloudflare dashboard and
has to be changed there.

## Quick Start - Testing New Mesh Primitives

### Option 1: Web Previewer (Fastest)

1. Start the web development server:
   ```bash
   pnpm dev:web
   ```

2. Open http://localhost:5173 in your browser

3. Click "Choose File" and select one of these test files:
   - `scenes/fixtures/unit-plane-mesh.tscn` - Green floor plane
   - `scenes/fixtures/unit-capsule-mesh.tscn` - Blue capsule
   - `scenes/fixtures/unit-torus-mesh.tscn` - Orange torus (donut)
   - `scenes/fixtures/unit-prism-mesh.tscn` - Purple triangular prism
   - `scenes/fixtures/integration-all-primitives.tscn` - **All primitives together with lighting**

4. Interact with the 3D view:
   - **Rotate**: Left mouse drag
   - **Pan**: Right mouse drag or Shift + left drag
   - **Zoom**: Mouse wheel
   - **Reset Camera**: Click "Reset Camera" button

### Option 2: VS Code Extension

1. Build and package the extension:
   ```bash
   pnpm build
   pnpm vsc:package
   ```

2. Install the `.vsix` file in VS Code:
   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X)
   - Click "..." → "Install from VSIX"
   - Select `apps/textscene-vscode/textscene-inspector-0.0.1.vsix`

3. Open the `scenes/fixtures/` folder in VS Code and pick any `.tscn` in it
   (opening the folder is what makes `res://` resolve)

4. Click the preview icon in the top-right corner or use:
   - Command Palette (Ctrl+Shift+P) → "TextScene: Open Preview to the Side"

## Scene Organization

### Unit scenes (`unit-*.tscn`)
Minimal scenes for testing individual node types.

| File | Mesh Type | Description | What to Verify |
|------|-----------|-------------|----------------|
| `unit-plane-mesh.tscn` | PlaneMesh | Green 10x10 floor plane with subdivisions | Check orientation (horizontal), subdivisions visible |
| `unit-capsule-mesh.tscn` | CapsuleMesh | Blue capsule (cylinder with rounded ends) | Verify smooth hemisphere caps, height conversion correct |
| `unit-torus-mesh.tscn` | TorusMesh | Orange metallic donut shape | Check inner/outer radius, ring details |
| `unit-prism-mesh.tscn` | PrismMesh | Purple triangular prism | Verify triangular cross-section, 3 sides |
| `unit-mesh-instance-basic.tscn` | BoxMesh | Basic mesh instance | Baseline comparison |
| `unit-node3d-basic.tscn` | Node3D | Simple node | Basic node verification |
| `unit-camera-basic.tscn` | Camera3D | Camera node | Camera setup verification |

### Integration and example scenes (`integration-*.tscn`, `example-*.tscn`)
Complex scenes exercising multiple nodes together, alongside the unit scenes at
the same `res://` root.

| File | Contents | Purpose |
|------|----------|---------|
| `integration-all-primitives.tscn` | All 4 new mesh types + lighting | **Best for full verification** - Shows all primitives with proper materials and lighting |
| `integration-lights-all-types.tscn` | Directional, Omni, and Spot lights | Light rendering verification |
| `integration-instanced-subscene.tscn` | Two instances of `res://unit-instance-child.tscn` | Sub-scene instancing |
| `example-hallway-mockup.tscn` | Complex architectural scene | Performance/integration testing |
| `example-hierarchy-deep.tscn` | Deep node hierarchy | Performance testing |
| `example-hierarchy-wide.tscn` | Wide node hierarchy | Performance testing |

## What to Look For

### PlaneMesh ✅
- [ ] Plane is horizontal (orientation = 1 for FACE_Y)
- [ ] Visible subdivisions (grid pattern with 5x5)
- [ ] Green color
- [ ] Positioned below origin (y = -1)

### CapsuleMesh ✅
- [ ] Smooth rounded caps at top and bottom
- [ ] Cylindrical middle section
- [ ] Blue metallic appearance
- [ ] Height = 3.0 units total (includes caps)

### TorusMesh ✅
- [ ] Perfect donut shape
- [ ] Hole in center (inner radius)
- [ ] Orange metallic finish
- [ ] Smooth ring segments

### PrismMesh ✅
- [ ] Triangular cross-section (3 sides)
- [ ] Purple color
- [ ] Vertical orientation
- [ ] Note: Simple approximation using CylinderGeometry with 3 radial segments

### All Primitives Scene ✅
- [ ] Floor plane at bottom
- [ ] Capsule on the left (-4, 0, 0)
- [ ] Torus in center (0, 0, 0)
- [ ] Prism on the right (4, 0, 0)
- [ ] Back wall visible
- [ ] Directional light casting shadows
- [ ] Fill light providing ambient illumination

## Interactive Features to Test

### Scene Tree Viewer (Left Panel)
- [ ] All nodes visible in hierarchy
- [ ] Click node to select it
- [ ] Selected node highlights in both tree and 3D view
- [ ] Expand/collapse works
- [ ] Search filters nodes

### Node Details Panel (Right Panel)
- [ ] Shows properties of selected node
- [ ] Transform, mesh type, material visible
- [ ] Properties update when selecting different nodes

### 3D Viewport
- [ ] Meshes render correctly
- [ ] Materials and colors display properly
- [ ] Lighting affects mesh appearance
- [ ] Shadows render (if enabled)
- [ ] Camera controls responsive

## Troubleshooting

### Meshes not appearing?
1. Check browser console (F12) for errors
2. Ensure build is up to date: `pnpm build`
3. Try hard refresh (Ctrl+Shift+R)

### Types not showing in editor?
1. Run: `pnpm type-check:all` (builds renderer automatically)
2. Reload VS Code window

### Renderer not installed?
```bash
pnpm install
pnpm build
```

## Creating Your Own Test Fixtures

Template for new mesh types:

```tscn
[gd_scene format=3]

[sub_resource type="YourMeshType" id="YourMeshType_1"]
property1 = value1
property2 = value2

[sub_resource type="StandardMaterial3D" id="Material_1"]
albedo_color = Color(r, g, b, a)
metallic = 0.5
roughness = 0.3

[node name="Root" type="Node3D"]

[node name="YourMesh" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
mesh = SubResource("YourMeshType_1")
surface_material_override/0 = SubResource("Material_1")
```

## Additional Resources

- **Godot TSCN Format**: https://docs.godotengine.org/en/4.4/contributing/development/file_formats/tscn.html
- **Three.js Geometries**: https://threejs.org/docs/#api/en/geometries
- **Project Architecture**: See `/ARCHITECTURE.md`
- **Roadmap & Work Items**: See the [GitHub issues](https://github.com/Vortiago/textscene-inspector/issues)
