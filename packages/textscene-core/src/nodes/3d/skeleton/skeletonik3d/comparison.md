---
type: SkeletonIK3D
category: 3D
status: linter-only
fixture: unit-skeleton-ik-3d.tscn
# image: unit-skeleton-ik-3d
visual: false
renders_as: nothing (a transform-only group)
---

# SkeletonIK3D

A deprecated FABRIK chain solver that walks the bones from `root_bone` to `tip_bone` and drags the tip onto a target over up to `max_iterations` passes. A stock 4.x build still saves and reloads it. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008).

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

The lenient parser reuses `parseNode3D`, so every key above is dropped rather than substituted, with no fallback to name. Strict checks only their format, since every setter in `skeleton_ik_3d.cpp` is a bare assignment, so a negative `max_iterations` or a bone name matching no bone passes.
