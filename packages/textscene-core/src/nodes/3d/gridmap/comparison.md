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

## Divergences

The nine tiles place pixel-for-pixel with Godot — same silhouette, same lower-left
notch, same recession. Tone is the one difference: our tile is a few values darker and
cooler (centre `93,99,111` → `82,88,98`, ~11/255 per channel, uniform across the plane).
Sky (`194,197,203`) and ground (`~60,54,37`) are identical in both images, so this is the
tile surface, not exposure or ambient. The quad's ArrayMesh declares no surface material,
so the previewer paints it with its neutral grey placeholder (`0xb0b0b0`), which reads
slightly darker than the surface Godot draws for the same material-less tile. Subtle, and
a placeholder-material effect — the GridMap geometry itself matches.

## Linting

<!-- lint:begin GridMap -->
Strict parsing format-checks these `GridMap` properties, plus 17 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `bake_navigation` | true or false |
| `baked_meshes` | Array of resource references ([SubResource("id"), …]) |
| `cell_center_x` | true or false |
| `cell_center_y` | true or false |
| `cell_center_z` | true or false |
| `cell_octant_size` | integer, nonzero, 1-1024 hinted |
| `cell_scale` | float |
| `cell_size` | Vector3(x, y, z) |
| `collision_layer` | 32-bit layer mask (layers 1-32) |
| `collision_mask` | 32-bit layer mask (layers 1-32) |
| `collision_priority` | float |
| `data` | Dictionary literal { "cells": PackedInt32Array(...) } |
| `mesh_library` | SubResource("id") or ExtResource("id") |
| `physics_material` | SubResource("id") or ExtResource("id") |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-gridmap-resources` | `gridmap-requires-mesh-library` | warning |
|  | `valid-gridmap-resources` | error |
<!-- lint:end -->

`cell_size` falls back to Godot's default `Vector3(2, 2, 2)` on a malformed value with no warning; the catch is silent, unlike Decal's equivalent. `mesh_library` is copied straight through when present and left `undefined` when absent, so the lenient parser never checks that the reference resolves. `cell_center_x`/`_y`/`_z` default to `true` only when none of the three properties is present at all; if any one is, each falls back individually through `boolOr` (default `true`, with a warning) rather than reverting to the shared all-true default.

## Known limitations

- **cell_scale** — a GridMap's `cell_scale` (default 1.0) is not parsed; a map that sets it would render every tile at the wrong size.
