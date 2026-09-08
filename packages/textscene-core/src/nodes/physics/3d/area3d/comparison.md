---
type: Area3D
category: 3D
status: linter-only
fixture: edge-area3d-inactive.tscn
image: edge-area3d-inactive
visual: false
renders_as: an invisible transform-only group
---

# Area3D

A physics region for detecting overlaps, with no runtime visual of its own. The previewer mounts it as a transform-only Node3D group, so both images show only the preview environment's sky.

## Linting

<!-- lint:begin Area3D -->
Strict parsing format-checks these `Area3D` properties, plus 6 inherited from CollisionObject3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `angular_damp` | float >= 0 | warning below |
| `angular_damp_space_override` | enum 0-4 (DISABLED/COMBINE/COMBINE_REPLACE/REPLACE/REPLACE_COMBINE) | warning |
| `audio_bus_name` | quoted string or &"name" |  |
| `audio_bus_override` | true or false |  |
| `gravity` | float |  |
| `gravity_direction` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `gravity_point` | true or false |  |
| `gravity_point_center` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `gravity_point_unit_distance` | float >= 0 | warning below |
| `gravity_space_override` | enum 0-4 (DISABLED/COMBINE/COMBINE_REPLACE/REPLACE/REPLACE_COMBINE) | warning |
| `linear_damp` | float >= 0 | warning below |
| `linear_damp_space_override` | enum 0-4 (DISABLED/COMBINE/COMBINE_REPLACE/REPLACE/REPLACE_COMBINE) | warning |
| `monitorable` | true or false |  |
| `monitoring` | true or false |  |
| `priority` | integer |  |
| `reverb_bus_amount` | float 0-1 | warning |
| `reverb_bus_enabled` | true or false |  |
| `reverb_bus_name` | quoted string or &"name" |  |
| `reverb_bus_uniformity` | float 0-1 | warning |
| `wind_attenuation_factor` | float >= 0 | warning below |
| `wind_force_magnitude` | float >= 0 | warning below |
| `wind_source_path` | NodePath("path/to/node") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-collisionobject3d-scale` (type-family match) | `collisionobject3d-non-uniform-scale` | warning |
| `valid-area3d` | `area3d-detects-nothing` | info |
|  | `area3d-monitoring-zero-mask` | info |
| `valid-collisionobject3d` (type-family match) | `collisionobject3d-needs-collision-shape` | warning |
<!-- lint:end -->

Area3D reuses `parseNode3D` unmodified, so none of its own properties (`monitoring`, the gravity and damp settings, `audio_bus_name`, `priority`) is ever read. The transform-only render needs none of them.
