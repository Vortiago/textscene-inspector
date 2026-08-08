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

Rotates one skeleton bone to face a target node. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `influence` | `0.75` | SkeletonModifier3D's blend weight, reached through the base-walk rather than declared here |
| `target_node` | `NodePath("../../Target")` | the node the bone turns towards |
| `bone_name` | `"Head"` | the bone the modifier drives |
| `bone` | `3` | the index Godot resolves that name to |
| `forward_axis` | `4` | +Z, the bone axis pointed at the target |
| `primary_rotation_axis` | `1` | Y, perpendicular to the forward axis as the rule below requires |
| `use_secondary_rotation` | `true` | rotates about a second axis, so the `secondary_*` keys serialise |
| `relative` | `false` | the result replaces the pose rather than composing with it |
| `origin_from` | `1` | ORIGIN_FROM_SPECIFIC_BONE, which is what makes `origin_bone*` serialise |
| `origin_bone_name` | `"Neck"` | the bone whose global pose is the ray origin |
| `origin_bone` | `2` | the index for that name |
| `origin_offset` | `Vector3(0, 0.05, 0)` | shifts the origin so paired bones can share a direction |
| `origin_safe_margin` | `0.1` | falls back to timed interpolation when the target passes this close to the origin |
| `duration` | `0.25` | seconds of interpolation after a target change or an axis flip |
| `transition_type` | `7` | Cubic, the Tween curve that interpolation follows |
| `ease_type` | `2` | InOut |
| `use_angle_limitation` | `true` | without it Godot serialises none of the limit or damp keys |
| `symmetry_limitation` | `false` | selects the positive/negative family over the symmetric pair |
| `primary_positive_limit_angle` | `1.0471976` | 60 degrees in radians, the primary swing one way |
| `primary_positive_damp_threshold` | `0.8` | damping starts at 80% of that limit |
| `primary_negative_limit_angle` | `3.1415927` | 180 degrees, the hint's ceiling and Godot's own default |
| `primary_negative_damp_threshold` | `0.5` | damping starts halfway |
| `secondary_positive_limit_angle` | `0.7853982` | 45 degrees |
| `secondary_positive_damp_threshold` | `1.0` | 1.0 means no damping at all |
| `secondary_negative_limit_angle` | `0.7853982` | 45 degrees |
| `secondary_negative_damp_threshold` | `0.0` | 0.0 means damping always applies |

## Divergences

None visible in this fixture: the node draws nothing in either engine.

## Linting

<!-- lint:begin LookAtModifier3D -->
Strict parsing format-checks these `LookAtModifier3D` properties, plus 2 inherited from SkeletonModifier3D, 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `bone` | integer >= -1 |
| `bone_name` | quoted string |
| `duration` | float >= 0 |
| `ease_type` | enum 0-3 (In/Out/InOut/OutIn) |
| `forward_axis` | enum 0-5 (+X/-X/+Y/-Y/+Z/-Z) |
| `origin_bone` | integer >= -1 |
| `origin_bone_name` | quoted string |
| `origin_external_node` | NodePath("path/to/node") |
| `origin_from` | enum 0-2 (Self/SpecificBone/ExternalNode) |
| `origin_offset` | Vector3(x, y, z) |
| `origin_safe_margin` | float >= 0 |
| `primary_damp_threshold` | float 0-1 |
| `primary_limit_angle` | radians, 0° to 360° |
| `primary_negative_damp_threshold` | float 0-1 |
| `primary_negative_limit_angle` | radians, 0° to 180° |
| `primary_positive_damp_threshold` | float 0-1 |
| `primary_positive_limit_angle` | radians, 0° to 180° |
| `primary_rotation_axis` | enum 0-2 (X/Y/Z) |
| `relative` | true or false |
| `secondary_damp_threshold` | float 0-1 |
| `secondary_limit_angle` | radians, 0° to 360° |
| `secondary_negative_damp_threshold` | float 0-1 |
| `secondary_negative_limit_angle` | radians, 0° to 180° |
| `secondary_positive_damp_threshold` | float 0-1 |
| `secondary_positive_limit_angle` | radians, 0° to 180° |
| `symmetry_limitation` | true or false |
| `target_node` | NodePath("path/to/node") |
| `transition_type` | enum 0-11 (Linear/Sine/Quint/Quart/Quad/Expo/Elastic/Cubic/Circ/Bounce/Back/Spring) |
| `use_angle_limitation` | true or false |
| `use_secondary_rotation` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
| `valid-lookatmodifier3d-rotation-axes` | `lookatmodifier3d-parallel-rotation-axes` | warning |
<!-- lint:end -->

The lenient parser reads LookAtModifier3D through `parseNode3D`, so it keeps only
`transform`, `visible` and the other Node3D keys; every property above is parsed as raw
text and substituted for nothing. Strict is where the six `radians_as_degrees` angles
matter: the inspector shows degrees while the `.tscn` stores radians, so
`primary_limit_angle = 7` is outside the stored 0..TAU ceiling even though 7 looks small
beside the hint's 360, and the strict parser warns where the lenient one carries the 7
through untouched. `linter.ts` adds the one cross-field warning Godot raises itself, when
`forward_axis` resolves to the same axis as `primary_rotation_axis`; the lenient parser
has no opinion on that pairing either.
