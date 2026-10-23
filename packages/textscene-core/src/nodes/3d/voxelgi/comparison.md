---
type: VoxelGI
category: 3D
status: unimplemented
fixture: unit-voxel-gi.tscn
# image: unit-voxel-gi
renders_as: nothing yet, Godot lights the scene from its voxel bake, the previewer does not
---

# VoxelGI

A real-time global illumination probe that bakes indirect light from static geometry into an octree. The previewer parses and validates it but does not run the bake or draw the probe volume. It draws nothing, and its children still show.

## Gizmo

A selected VoxelGI draws the gizmo of Godot's editor in the VoxelGI colour. Godot's source is `voxel_gi_gizmo_plugin.cpp:96-164`. Godot draws the lines only for the selected node (`:99`).

- The 12 edges of the box, a box of `size` centred on the node.
- The grid of its cells at an opacity of 0.02. The longest side holds 64, 128, 256 or 512 cells by `subdiv`, and each plane inside the box draws four segments.

The previewer draws no edit handles and no billboard icon.

## Linting

<!-- lint:begin VoxelGI -->

Strict parsing format-checks these `VoxelGI` properties, plus 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property            | Accepts                                                        | Out of range |
| ------------------- | -------------------------------------------------------------- | ------------ |
| `camera_attributes` | null, SubResource("id"), ExtResource("id") or Resource("path") |              |
| `data`              | null, SubResource("id"), ExtResource("id") or Resource("path") |              |
| `size`              | Vector3(x, y, z), each float >= 1                              | error below  |
| `subdiv`            | enum 0-3 (SUBDIV_64/SUBDIV_128/SUBDIV_256/SUBDIV_512)          | error        |

| Rule                                          | Reports                     | Severity |
| --------------------------------------------- | --------------------------- | -------- |
| `binary-resource-reference` (all nodes)       | `binary-resource-reference` | info     |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility`   | error    |
| `valid-voxelgi-data`                          | `voxelgi-missing-data`      | warning  |

<!-- lint:end -->

The lenient parser reads `size` and `subdiv` for the gizmo. It raises each side of `size` below 1 to 1, as `set_size` does. A malformed value or a `subdiv` outside 0 to 3 keeps Godot's default.

## Known limitations

- **Not drawn** Godot lights dynamic objects from the baked probe, but the previewer applies no indirect light from it.
