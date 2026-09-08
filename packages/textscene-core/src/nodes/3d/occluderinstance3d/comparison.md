---
type: OccluderInstance3D
category: 3D
status: linter-only
fixture: unit-occluder-instance-3d.tscn
# image: unit-occluder-instance-3d
visual: false
renders_as: nothing (a transform-only group)
---

# OccluderInstance3D

Holds a baked occluder shape for Godot's occlusion culling. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin OccluderInstance3D -->
Strict parsing format-checks these `OccluderInstance3D` properties, plus 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `bake_mask` | 32-bit layer mask (layers 1-32) |  |
| `bake_simplification_distance` | float 0-2 | error below, warning above |
| `occluder` | null, SubResource("id") or ExtResource("id") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-occluderinstance3d-configuration` | `occluderinstance3d-empty-bake-mask` | warning |
|  | `occluderinstance3d-missing-occluder` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads only `transform` and `visible`. A malformed `bake_mask = "off"` or a `bake_simplification_distance = -5` parses with no warning and reaches no in-memory state, while strict reports it.
