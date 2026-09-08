---
type: GridMap
category: 3D
status: unreviewed
fixture: unit-grid-map.tscn
image: unit-grid-map
renders_as: a THREE.InstancedMesh per MeshLibrary item
---

# GridMap

Instances each populated cell's `MeshLibrary` item mesh, batching cells of the same item into one `THREE.InstancedMesh`. The fixture's nine flat tiles read as one grey surface receding to the upper right in both images.

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
| `mesh_library` | null, SubResource("id") or ExtResource("id") |  |
| `physics_material` | null, SubResource("id") or ExtResource("id") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-gridmap-resources` | `gridmap-requires-mesh-library` | info |
<!-- lint:end -->

`cell_size` falls back silently to Godot's default `Vector3(2, 2, 2)` on a malformed value. `mesh_library` is copied straight through when present, with no check that it resolves. `cell_center_x`, `_y` and `_z` default to `true` when all three are absent, and otherwise each warns and falls back to `true` on its own through `boolOr`.

## Known limitations

- **Approximated** A tile whose mesh declares no material gets the previewer's neutral grey placeholder, which reads a few values darker than Godot's.
- **Approximated** `cell_scale` is not parsed, so a map that sets it renders every tile at the wrong size.
