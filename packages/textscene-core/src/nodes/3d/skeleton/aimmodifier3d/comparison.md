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

AimModifier3D rotates a bone of its parent skeleton to point at a reference bone or node, a simplified LookAtModifier3D without angle limits or time-based interpolation. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `setting_count` | `1` | one aim setting exists; every `settings/0/...` key below needs it |
| `settings/0/amount` | `0.75` | BoneConstraint3D's blend weight, three quarters of the way to the aimed pose |
| `settings/0/forward_axis` | `4` | the bone points along its local +Z |
| `settings/0/use_euler` | `true` | rotate by two euler steps instead of one arc |
| `settings/0/primary_rotation_axis` | `1` | the first euler rotation turns about Y |
| `settings/0/use_secondary_rotation` | `false` | stop after the primary rotation |
| `settings/0/relative` | `false` | aim relative to the bone rest rather than its current pose |

## Divergences

None visible in this fixture: the node draws nothing in either engine.

## Linting

<!-- lint:begin AimModifier3D -->
Strict parsing format-checks these `AimModifier3D` properties, plus 2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `setting_count` | integer >= 0 | error |
| `settings/#/*` | setting | error |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
| `valid-aimmodifier3d-rotation-axes` | `aimmodifier3d-parallel-rotation-axes` | warning |
<!-- lint:end -->

The whole `settings/<index>/` family is hand-rolled, built in `_get_property_list`
rather than declared by any `ADD_PROPERTY`, and two classes write into the same
prefix: five leaves are AimModifier3D's, and seven more come from BoneConstraint3D.
The dispatcher recognises both sets so a real scene is never reported as carrying
unknown keys, but it validates only its own five; the base's leaves pass through
untouched, and the lenient parser keeps whatever value it read for them.

Both axis properties are enum HINTS with no setter enforcement behind them, so an
out-of-range `forward_axis` or `primary_rotation_axis` is a warning: strict reports
the value, and the lenient parser stores it as written rather than clamping. The
`aimmodifier3d-parallel-rotation-axes` rule is the only cross-field check, and it
mirrors Godot's own configuration warning: with `use_euler` on, a forward axis that
resolves to the primary rotation axis makes the projection degenerate.
