---
type: LookAtModifier3D
category: 3D
status: linter-only
fixture: unit-look-at-modifier-3d.tscn
# image: unit-look-at-modifier-3d
visual: false
renders_as: nothing (a transform-only group)
---

# LookAtModifier3D

Rotates one skeleton bone to face a target node, with optional angle limits and timed interpolation. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin LookAtModifier3D -->
Strict parsing format-checks these `LookAtModifier3D` properties, plus 2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `bone` | integer >= -1 | error below |
| `bone_name` | quoted string, or the &"…" StringName jacket |  |
| `duration` | float >= 0 | warning below |
| `ease_type` | enum 0-3 (In/Out/InOut/OutIn) | warning |
| `forward_axis` | enum 0-5 (+X/-X/+Y/-Y/+Z/-Z) | warning |
| `origin_bone` | integer >= -1 | error below |
| `origin_bone_name` | quoted string, or the &"…" StringName jacket |  |
| `origin_external_node` | NodePath("path/to/node") |  |
| `origin_from` | enum 0-2 (Self/SpecificBone/ExternalNode) | warning |
| `origin_offset` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `origin_safe_margin` | float >= 0 | warning below |
| `primary_damp_threshold` | float 0-1 | warning |
| `primary_limit_angle` | radians, 0° to 360° | warning |
| `primary_negative_damp_threshold` | float 0-1 | warning |
| `primary_negative_limit_angle` | radians, 0° to 180° | warning |
| `primary_positive_damp_threshold` | float 0-1 | warning |
| `primary_positive_limit_angle` | radians, 0° to 180° | warning |
| `primary_rotation_axis` | enum 0-2 (X/Y/Z) | warning |
| `relative` | true or false |  |
| `secondary_damp_threshold` | float 0-1 | warning |
| `secondary_limit_angle` | radians, 0° to 360° | warning |
| `secondary_negative_damp_threshold` | float 0-1 | warning |
| `secondary_negative_limit_angle` | radians, 0° to 180° | warning |
| `secondary_positive_damp_threshold` | float 0-1 | warning |
| `secondary_positive_limit_angle` | radians, 0° to 180° | warning |
| `symmetry_limitation` | true or false |  |
| `target_node` | NodePath("path/to/node") |  |
| `transition_type` | enum 0-11 (Linear/Sine/Quint/Quart/Quad/Expo/Elastic/Cubic/Circ/Bounce/Back/Spring) | warning |
| `use_angle_limitation` | true or false |  |
| `use_secondary_rotation` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
| `valid-lookatmodifier3d-rotation-axes` | `lookatmodifier3d-parallel-rotation-axes` | warning |
<!-- lint:end -->

The lenient parser reads LookAtModifier3D through `parseNode3D`, so every property above is dropped with no fallback. Strict warns on a `primary_limit_angle` above TAU, since the `.tscn` stores radians while the inspector shows degrees, and `linter.ts` warns when `forward_axis` resolves to the same axis as `primary_rotation_axis`.
