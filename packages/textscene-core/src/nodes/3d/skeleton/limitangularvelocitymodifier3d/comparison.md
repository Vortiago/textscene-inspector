---
type: LimitAngularVelocityModifier3D
category: 3D
status: linter-only
fixture: unit-limit-angular-velocity-modifier-3d.tscn
# image: unit-limit-angular-velocity-modifier-3d
visual: false
renders_as: nothing (a transform-only group)
---

# LimitAngularVelocityModifier3D

Caps how fast a bone may rotate. Each frame it compares a bone's pose rotation
against the one it held last frame and, where the angle between them exceeds
`max_angular_velocity * delta`, slerps only that far instead of all the way. It
is a post-process on someone else's pose, so it draws nothing at runtime and the
previewer renders it as a transform-only group (ADR-0008) whose children keep
their transform space.

Which bones it touches is set up by `chains/<i>/`, a root bone and an end bone
per chain; the class then walks the skeleton from end to root and collects every
bone in between into a joint list. `exclude` inverts the result, so the modifier
limits every bone that is NOT in that list.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `max_angular_velocity` | `3.1415927` | caps rotation at PI radians per second, which the inspector shows as 180 degrees per second |
| `exclude` | `true` | limits every bone the chains do NOT cover, rather than the chained ones |
| `chain_count` | `1` | allocates one root-to-end bone chain |
| `chains/0/root_bone_name` | `"UpperArm.L"` | names the chain's root bone; the index below is resolved from it once a skeleton with that bone is present |
| `chains/0/root_bone` | `-1` | the unset sentinel, which is what the name resolves to against this fixture's bare skeleton and the one index the setter leaves alone |
| `chains/0/end_bone_name` | `"UpperArm.L"` | the same bone, the shortest chain the class accepts |
| `chains/0/end_bone` | `-1` | the unset sentinel again, for the same reason |

`max_angular_velocity` is the one `radians_as_degrees` property here, and the
whole reason this fixture exists. Its hint reads `0,720,or_greater`, in DEGREES
per second, while the `.tscn` stores RADIANS per second: 720 degrees is 4 PI, or
12.566371 stored, and the class default of 6.2831855 is one full turn a second.
`or_greater` opens the top of that hint, so the only bound anything can report
is the floor, and 0 is 0 in both units.

## Divergences

None visible in this fixture. The node has no runtime appearance to diverge in,
and the previewer poses no skeleton, so the cap never runs.

## Linting

<!-- lint:begin LimitAngularVelocityModifier3D -->
Strict parsing format-checks these `LimitAngularVelocityModifier3D` properties, plus 2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `chain_count` | integer >= 0 | error below |
| `chains/#/*` | LimitAngularVelocityModifier3D chain |  |
| `exclude` | true or false |  |
| `joints/#/*` | read-only (derived from LimitAngularVelocityModifier3D's per-chain root_bone and end_bone) |  |
| `max_angular_velocity` | float >= 0 | warning below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads exactly `transform` and
`visible`, so every key above is dropped before it reaches the scene tree and
there is no fallback value to report: the two parsers cannot disagree about a
property only one of them keeps. What strict adds is entirely about values Godot
would refuse or a scene author would misread.

Two of those are worth naming. `chain_count = -1` is an error, because
`set_chain_count` opens with an `ERR_FAIL_COND` and the resize never happens,
whereas `max_angular_velocity = -0.01` is only a warning: that bound comes from
the property's range hint, which governs the inspector's spinner, and the setter
itself assigns whatever it is handed. And the `joints/<i>/` keys the class
exposes are rejected outright rather than range-checked. Godot derives that list
from the chains and marks both of its keys read-only with no storage flag, so it
never writes them, and a hand-written one is discarded on load instead of
applied. A scene carrying `joints/0/bone` looks configured and is not.
