---
type: Bone2D
category: 2D
status: linter-only
fixture: unit-bone-2d.tscn
# image: unit-bone-2d
visual: false
renders_as: nothing (a transform-only group, the bone gizmo is editor-only)
---

# Bone2D

Bone2D is one bone of a Skeleton2D chain. Its gizmo draws only in the editor, so at
runtime the node is a transform, and the previewer renders it as a transform-only group
(ADR-0008).

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

The lenient parser reuses `parseNode2D`, which reads none of the five bone keys. A
`length` of `2048` or a `bone_angle` of `900` is carried through untouched and changes
nothing on screen, where strict warns on both. `default_length` is a legacy alias Godot
never writes, so an old scene carrying it lints clean.
