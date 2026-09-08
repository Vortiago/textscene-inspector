---
type: AimModifier3D
category: 3D
status: linter-only
fixture: unit-aim-modifier-3d.tscn
# image: unit-aim-modifier-3d
visual: false
renders_as: nothing (a transform-only group)
---

# AimModifier3D

Rotates a bone of its parent skeleton to point at a reference bone or node, a simplified LookAtModifier3D without angle limits or interpolation. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin AimModifier3D -->
Strict parsing format-checks these `AimModifier3D` properties, plus 2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `setting_count` | integer >= 0 | error below |
| `settings/#/*` | setting |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
| `valid-aimmodifier3d-rotation-axes` | `aimmodifier3d-parallel-rotation-axes` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, so every `settings/<i>/` leaf is dropped rather than substituted. Strict warns on an out-of-range `forward_axis` or `primary_rotation_axis` rather than erroring, since Godot's setter assigns it unclamped.
