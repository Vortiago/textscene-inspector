---
type: VoxelGI
category: 3D
status: unimplemented
fixture: unit-voxel-gi.tscn
# image: unit-voxel-gi
renders_as: an invisible transform-only fallback
---

# VoxelGI

A real-time global illumination probe: it bakes indirect light and reflections from
static geometry and lights into an octree, then feeds that back to dynamic objects at
runtime. The previewer parses and validates this node but does not run the bake or
draw the probe volume yet, so it renders as an invisible transform-only fallback and
its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `subdiv` | `2` | Octree subdivision level (`SUBDIV_256`) — finer voxel detail, slower bake. |
| `size` | `Vector3(30, 20, 30)` | World-space extents of the baked probe volume. |
| `camera_attributes` | `SubResource("CameraAttributesPractical_1")` | Exposure settings used to normalize the bake's brightness. |
| `data` | `SubResource("VoxelGIData_1")` | The baked octree/distance-field data this probe reads at runtime. |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin VoxelGI -->
Strict parsing format-checks these `VoxelGI` properties, plus 1 inherited from VisualInstance3D, 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `camera_attributes` | SubResource("id") or ExtResource("id") |
| `data` | SubResource("id") or ExtResource("id") |
| `size` | Vector3(x, y, z), each float >= 1 |
| `subdiv` | enum 0-3 (SUBDIV_64/SUBDIV_128/SUBDIV_256/SUBDIV_512) |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-voxelgi-data` | `voxelgi-missing-data` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads only `transform` and
`visible` off any node; `subdiv`, `size`, `camera_attributes`, and `data` are
never inspected at all. A malformed value for any of them — `subdiv = "banana"`,
`size = "not-a-vector"` — sits untouched in the raw property bag: no crash, no
substitution, and no rendering effect either way, since nothing here draws yet.
