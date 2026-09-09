---
type: Area2D
category: 2D
status: linter-only
fixture: unit-area2d.tscn
image: unit-area2d
visual: false
renders_as: a transform-only Node2D group
---

# Area2D

A 2D physics region that detects overlaps. It has no runtime visual, so the previewer mounts it as a transform-only Node2D group (ADR-0008). Both captures are an empty grey frame.

## Linting

<!-- lint:begin Area2D -->
Strict parsing format-checks these `Area2D` properties, plus 5 inherited from CollisionObject2D, 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `angular_damp` | float >= 0 | warning below |
| `angular_damp_space_override` | enum 0-4 (DISABLED/COMBINE/COMBINE_REPLACE/REPLACE/REPLACE_COMBINE) | warning |
| `audio_bus_name` | quoted string or &"name" |  |
| `audio_bus_override` | true or false |  |
| `gravity` | float |  |
| `gravity_direction` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `gravity_point` | true or false |  |
| `gravity_point_center` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `gravity_point_unit_distance` | float >= 0 | warning below |
| `gravity_space_override` | enum 0-4 (DISABLED/COMBINE/COMBINE_REPLACE/REPLACE/REPLACE_COMBINE) | warning |
| `linear_damp` | float >= 0 | warning below |
| `linear_damp_space_override` | enum 0-4 (DISABLED/COMBINE/COMBINE_REPLACE/REPLACE/REPLACE_COMBINE) | warning |
| `monitorable` | true or false |  |
| `monitoring` | true or false |  |
| `priority` | integer |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-area2d` | `area2d-detects-nothing` | info |
|  | `area2d-monitoring-zero-mask` | info |
| `valid-collisionobject2d` (type-family match) | `collisionobject2d-needs-collision-shape` | warning |
<!-- lint:end -->

The lenient parser reads only `monitoring`, `monitorable`, `collision_layer` and `collision_mask` through the `parseOptional*` readers, which omit an absent or unparseable value with no warning. Every other Area2D property is never read, since none touches a pixel.
