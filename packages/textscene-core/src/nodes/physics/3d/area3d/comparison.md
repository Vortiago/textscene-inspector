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

Area3D is a physics region for detecting overlaps; it has no runtime visual of its
own. The previewer mounts it as a transform-only Node3D group, so it draws nothing.
Its child `CollisionShape3D` is a toggle-gated overlay (ADR-0005/0006) and stays
hidden in a plain capture. Both images show only the preview environment's
procedural sky — a grey-blue gradient fading to a brown ground below the horizon.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `monitoring` | `false` | physics-only flag, no visual |
| `monitorable` | `false` | physics-only flag, no visual |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin Area3D -->
Strict parsing format-checks these `Area3D` properties, plus 6 inherited from CollisionObject3D, 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `angular_damp` | float >= 0 |
| `angular_damp_space_override` | enum 0-4 (DISABLED/COMBINE/COMBINE_REPLACE/REPLACE/REPLACE_COMBINE) |
| `audio_bus_name` | quoted string or &"name" |
| `audio_bus_override` | true or false |
| `gravity` | float |
| `gravity_direction` | Vector3(x, y, z) |
| `gravity_point` | true or false |
| `gravity_point_center` | Vector3(x, y, z) |
| `gravity_point_unit_distance` | float >= 0 |
| `gravity_space_override` | enum 0-4 (DISABLED/COMBINE/COMBINE_REPLACE/REPLACE/REPLACE_COMBINE) |
| `linear_damp` | float >= 0 |
| `linear_damp_space_override` | enum 0-4 (DISABLED/COMBINE/COMBINE_REPLACE/REPLACE/REPLACE_COMBINE) |
| `monitorable` | true or false |
| `monitoring` | true or false |
| `priority` | float |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-collisionobject3d-scale` (type-family match) | `collisionobject3d-non-uniform-scale` | warning |
| `valid-area3d` | `area3d-needs-collision-shape` | warning |
|  | `area3d-detects-nothing` | warning |
|  | `area3d-monitoring-zero-mask` | warning |
<!-- lint:end -->

Area3D has no `parser.ts`: the lenient path reuses `parseNode3D` unmodified,
so none of the Area3D-specific properties the strict validators cover
(`monitoring`, the gravity and damp settings,
`collision_layer`/`collision_mask`, `audio_bus_name`, `priority`) are ever
read. The transform-only render needs none of them, so there is nothing to
substitute.
