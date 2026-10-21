---
type: GridMap
category: 3D
status: limitation
fixture: unit-grid-map.tscn
image: unit-grid-map
renders_as: a THREE.InstancedMesh per MeshLibrary item surface, or a mesh per cell when that surface's material billboards
---

# GridMap

Instances each populated cell's `MeshLibrary` item mesh, batching the cells of each item surface into one `THREE.InstancedMesh` with that surface's material. The item mesh is an ArrayMesh or a PrimitiveMesh, embedded in the library or in its own `.tres`. A surface whose material billboards draws one mesh per cell instead, so it turns about its own cell as Godot's does. The fixture's nine flat tiles read as one grey surface receding to the upper right in both images.

Each mesh scales by `cell_scale` round its cell's place. A cell whose item has no mesh draws nothing.

A GridMap that holds `baked_meshes` draws them in place of its cells, as Godot does once a LightmapGI bakes it. Each baked mesh reads the lightmap the bake gives its index.

## Linting

<!-- lint:begin GridMap -->
Strict parsing format-checks these `GridMap` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `bake_navigation` | true or false |  |
| `baked_meshes` | Array of resource references ([SubResource("id"), …]) |  |
| `cell_center_x` | true or false |  |
| `cell_center_y` | true or false |  |
| `cell_center_z` | true or false |  |
| `cell_octant_size` | integer, nonzero, 1-1024 hinted | warning |
| `cell_scale` | float |  |
| `cell_size` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `collision_layer` | 32-bit layer mask (layers 1-32) |  |
| `collision_mask` | 32-bit layer mask (layers 1-32) |  |
| `collision_priority` | float |  |
| `data` | Dictionary literal { "cells": PackedInt32Array(...) } |  |
| `mesh_library` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `physics_material` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-gridmap-resources` | `gridmap-requires-mesh-library` | info |
<!-- lint:end -->

`cell_size` warns and falls back to Godot's default `Vector3(2, 2, 2)` on a malformed value. `cell_scale` warns and falls back to `1` on a malformed or non-finite value. `mesh_library` is copied straight through when present, with no check that it resolves. `cell_center_x`, `_y` and `_z` default to `true` when all three are absent. Otherwise each warns and falls back to `true` on its own through `boolOr`.
