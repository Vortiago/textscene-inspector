---
type: Bone2D
category: 2D
status: done
fixture: unit-bone-2d.tscn
# image: unit-bone-2d
visual: false
renders_as: a kite gizmo for every bone
---

# Bone2D

Bone2D is one bone of a Skeleton2D chain. The previewer draws Godot's editor kite for every
bone (ADR-0056). The kite runs from the bone to each Bone2D child, or along `length` and
`bone_angle` for a bone with none. The outline turns red for the selected bone. A capture keeps the
Gizmos toggle off, so a plain capture shows nothing, as Godot's game render does. A bone with
`editor_settings/show_bone_gizmo` off draws no kite. A bone that a modification of
its Skeleton2D holds shades its kite yellow, as Godot does. Under a skeleton with no stack, the saved
`metadata/_local_pose_override_enabled_` decides that. The pose of a bone against its `rest` moves the
Polygon2Ds its skeleton deforms.

## Linting

<!-- lint:begin Bone2D -->
Strict parsing format-checks these `Bone2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `auto_calculate_length_and_angle` | true or false |  |
| `bone_angle` | float -360-360 | warning |
| `editor_settings/show_bone_gizmo` | true or false |  |
| `length` | float 1-1024 | warning |
| `rest` | Transform2D(6 floats) |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-bone2d-ancestry` | `bone2d-chain-does-not-terminate` | warning |
|  | `bone2d-invalid-parent` | warning |
|  | `bone2d-missing-rest-pose` | warning |
<!-- lint:end -->

The lenient parser reads `rest`, `auto_calculate_length_and_angle`, `length`, `bone_angle` and
`editor_settings/show_bone_gizmo` on top of `parseNode2D`. A `rest` that is not a finite
Transform2D warns and reads as the all-zero unset rest. A `length` of `2048` or a `bone_angle`
of `900` is drawn as written, where strict warns on both. `default_length` is a legacy alias Godot
never writes, so an old scene carrying it lints clean.
