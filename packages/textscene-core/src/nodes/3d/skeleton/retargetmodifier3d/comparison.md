---
type: RetargetModifier3D
category: 3D
status: linter-only
fixture: unit-retarget-modifier-3d.tscn
# image: unit-retarget-modifier-3d
visual: false
renders_as: a transform-only group
---

# RetargetModifier3D

Copies the parent Skeleton3D's pose onto the Skeleton3D nodes beneath it, remapping through a `SkeletonProfile` so two rigs can share one animation. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin RetargetModifier3D -->
Strict parsing format-checks these `RetargetModifier3D` properties, plus 2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `enable` | bit mask of TRANSFORM_FLAG_POSITION (1) \| TRANSFORM_FLAG_ROTATION (2) \| TRANSFORM_FLAG_SCALE (4) |  |
| `profile` | null, SubResource("id") or ExtResource("id") |  |
| `use_global_pose` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
| `valid-retargetmodifier3d-child-skeleton` (type-family match) | `retargetmodifier3d-no-child-skeleton` | warning |
<!-- lint:end -->

The `retargetmodifier3d-no-child-skeleton` rule stays silent when a child's class lives
elsewhere. An `instance=` node, or a class the pinned catalog does not list, may be a
Skeleton3D.

RetargetModifier3D registers `parseNode3D` directly, so `profile`, `use_global_pose` and `enable` are never read by the lenient parser. A malformed value is dropped rather than substituted, and an `enable` bit past the three the inspector lists is only a warning on the strict side.
