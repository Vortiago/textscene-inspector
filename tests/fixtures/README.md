# TSCN Test Fixtures

This directory contains test fixtures for manually verifying the TSCN renderer implementations.

## Quick Start - Testing New Mesh Primitives

### Option 1: Web Previewer (Fastest)

1. Start the web development server:
   ```bash
   pnpm dev:web
   ```

2. Open http://localhost:5173 in your browser

3. Click "Choose File" and select one of these test files:
   - `tests/fixtures/planemesh.tscn` - Green floor plane
   - `tests/fixtures/capsulemesh.tscn` - Blue capsule
   - `tests/fixtures/torusmesh.tscn` - Orange torus (donut)
   - `tests/fixtures/prismmesh.tscn` - Purple triangular prism
   - `tests/fixtures/all_new_primitives.tscn` - **All primitives together with lighting**

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

3. Open any `.tscn` file from `tests/fixtures/` in VS Code

4. Click the preview icon in the top-right corner or use:
   - Command Palette (Ctrl+Shift+P) → "TextScene: Open Preview to the Side"

## Test Fixtures Overview

### Individual Mesh Primitives

| File | Mesh Type | Description | What to Verify |
|------|-----------|-------------|----------------|
| `planemesh.tscn` | PlaneMesh | Green 10x10 floor plane with subdivisions | Check orientation (horizontal), subdivisions visible |
| `capsulemesh.tscn` | CapsuleMesh | Blue capsule (cylinder with rounded ends) | Verify smooth hemisphere caps, height conversion correct |
| `torusmesh.tscn` | TorusMesh | Orange metallic donut shape | Check inner/outer radius, ring details |
| `prismmesh.tscn` | PrismMesh | Purple triangular prism | Verify triangular cross-section, 3 sides |

### Comprehensive Scenes

| File | Contents | Purpose |
|------|----------|---------|
| `all_new_primitives.tscn` | All 4 new mesh types + lighting | **Best for full verification** - Shows all primitives with proper materials and lighting |
| `mesh_instance.tscn` | BoxMesh (existing) | Baseline comparison |
| `lights.tscn` | Various light types | Light rendering verification |
| `Hallway.tscn` | Complex scene | Performance/integration testing |

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
- **Implementation Details**: See `/work_items/WI18.md`
