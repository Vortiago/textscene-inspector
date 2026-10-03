---
type: SkeletonIK3D
category: 3D
status: unimplemented
fixture: unit-skeleton-ik-3d.tscn
# image: unit-skeleton-ik-3d
visual: false
renders_as: nothing yet, Godot solves its deprecated chain onto the target, the previewer does not
---

# SkeletonIK3D

A deprecated FABRIK chain solver that stock 4.x builds still save and reload. It walks the bones from `root_bone` to `tip_bone` and drags the tip onto a target over up to `max_iterations` passes. Godot runs the solver each frame, and the previewer does not yet (ADR-0045). The bones hold their rest pose.

## Linting

<!-- lint:begin SkeletonIK3D -->
Strict parsing format-checks these `SkeletonIK3D` properties, plus 2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `magnet` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `max_iterations` | integer |  |
| `min_distance` | float |  |
| `override_tip_basis` | true or false |  |
| `root_bone` | quoted string or &"name" |  |
| `target` | Transform3D(12 floats) |  |
| `target_node` | NodePath("path/to/node") |  |
| `tip_bone` | quoted string or &"name" |  |
| `use_magnet` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, so every key above is dropped rather than substituted, with no fallback to name. Strict checks only their format, since every setter in `skeleton_ik_3d.cpp` is a bare assignment. A negative `max_iterations` or a bone name that matches no bone passes.
