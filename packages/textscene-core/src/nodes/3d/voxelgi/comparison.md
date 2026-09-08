---
type: VoxelGI
category: 3D
status: unimplemented
fixture: unit-voxel-gi.tscn
# image: unit-voxel-gi
renders_as: an invisible transform-only fallback
---

# VoxelGI

A real-time global illumination probe that bakes indirect light from static geometry into an octree. The previewer parses and validates it but does not run the bake or draw the probe volume, so it mounts as an invisible transform-only group.

## Linting

<!-- lint:begin VoxelGI -->
Strict parsing format-checks these `VoxelGI` properties, plus 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `camera_attributes` | null, SubResource("id") or ExtResource("id") |  |
| `data` | null, SubResource("id") or ExtResource("id") |  |
| `size` | Vector3(x, y, z), each float >= 1 | error below |
| `subdiv` | enum 0-3 (SUBDIV_64/SUBDIV_128/SUBDIV_256/SUBDIV_512) | error |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-voxelgi-data` | `voxelgi-missing-data` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads only `transform` and `visible`. A malformed `subdiv` or `size` sits untouched in the raw property bag with no substitution, since nothing here draws from it.

## Known limitations

- **Not drawn** Godot lights dynamic objects from the baked probe. The previewer applies no indirect light from it.
