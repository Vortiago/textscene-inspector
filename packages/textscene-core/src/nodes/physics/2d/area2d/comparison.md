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

Area2D is a 2D physics region that detects overlaps. Like every physics body it
has no runtime visual, so the previewer mounts it as a transform-only Node2D
group (ADR-0005/ADR-0008) and draws nothing for it. Both captures are an empty
grey frame.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `position` | `Vector2(10, 20)` | shifts the invisible node; no pixels |
| `collision_layer` | `4` | physics config; not drawn |
| `collision_mask` | `1` | physics config; not drawn |
| `monitoring` | `true` | physics config; not drawn |
| `monitor_neighbors` | `true` | physics config; not drawn |

The child `CollisionShape2D` (a `CircleShape2D`) is a selection-gated gizmo and
does not appear in a plain capture. The child `ColorRect` (color
`Color(1, 0.4, 0.4, 1)`) carries no size, so its rect is empty and it too draws
nothing.

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin Area2D -->
Strict parsing format-checks these `Area2D` properties, plus 5 inherited from CollisionObject2D, 12 inherited from Node2D, 15 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `angular_damp` | float >= 0 |
| `angular_damp_space_override` | enum 0-4 (DISABLED/COMBINE/COMBINE_REPLACE/REPLACE/REPLACE_COMBINE) |
| `audio_bus_name` | quoted string or &"name" |
| `audio_bus_override` | true or false |
| `gravity` | float |
| `gravity_direction` | Vector2(x, y) |
| `gravity_point` | true or false |
| `gravity_point_center` | Vector2(x, y) |
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
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-area2d` | `area2d-needs-collision-shape` | warning |
|  | `area2d-inactive` | warning |
|  | `area2d-monitoring-zero-layer` | warning |
|  | `area2d-monitoring-zero-mask` | warning |
|  | `area2d-monitoring-no-collision` | warning |
|  | `area2d-audio-override-missing-name` | warning |
<!-- lint:end -->

The lenient parser only reads `monitoring`, `monitorable`, `collision_layer`, and
`collision_mask`, via `parseOptionalBool`/`parseOptionalInt`: an absent or
unparseable value returns `undefined` and the property is simply omitted from
the parsed node, with no warning. Every other Area2D property the strict
validators cover (`gravity`, the damp settings, `priority`,
`audio_bus_name`, `disable_mode`) is never read by the lenient parser at all,
since the node renders as a transform-only group and none of them touch a
pixel.
