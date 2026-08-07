---
type: GridMap
category: 3D
fixture: unit-grid-map.tscn
image: unit-grid-map
renders_as: a THREE.InstancedMesh per MeshLibrary item
---

# GridMap

GridMap instances each populated cell's MeshLibrary item mesh, batching cells of the
same item into one THREE.InstancedMesh. This fixture places one flat quad tile across
nine cells, which read as a single grey tiled surface receding to the upper right.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `mesh_library` | ExtResource (`unit-grid-map-lib.tres`) | supplies the tile mesh — a flat 2×2 quad |
| `cell_size` | `Vector3(2, 2, 2)` | 2-unit spacing, so the 2×2 tiles abut without gaps |
| `data` / `cells` | 9 cells, item 0 | the populated 3×3 patch that fills the frame |

## Linting

<!-- lint:begin GridMap -->
Strict parsing format-checks these `GridMap` properties, plus 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `cell_center_x` |
| `cell_center_y` |
| `cell_center_z` |
| `cell_size` |
| `mesh_library` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-gridmap-resources` | `gridmap-requires-mesh-library` | warning |
|  | `valid-gridmap-resources` | error |
<!-- lint:end -->

`cell_size` falls back to Godot's default `Vector3(2, 2, 2)` on a malformed value with no warning; the catch is silent, unlike Decal's equivalent. `mesh_library` is copied straight through when present and left `undefined` when absent, so the lenient parser never checks that the reference resolves. `cell_center_x`/`_y`/`_z` default to `true` only when none of the three properties is present at all; if any one is, each falls back individually through `boolOr` (default `true`, with a warning) rather than reverting to the shared all-true default.

## Known limitations

- **cell_scale** — a GridMap's `cell_scale` (default 1.0) is not parsed; a map that sets it would render every tile at the wrong size.
- **One material per item.** The item mesh's first surface material is applied to the whole InstancedMesh, so a multi-surface tile draws every surface with surface 0's material.
