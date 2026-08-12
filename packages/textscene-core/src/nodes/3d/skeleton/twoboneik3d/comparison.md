---
type: TwoBoneIK3D
category: 3D
status: linter-only
fixture: unit-two-bone-ik-3d.tscn
# image: unit-two-bone-ik-3d
visual: false
renders_as: nothing (a transform-only group)
---

# TwoBoneIK3D

A rotation-based two-bone IK solver: it builds a plane from the root, middle and
end joints plus a pole target, intersects two circles on that plane, and poses
the skeleton so the end bone reaches the target. It draws nothing at runtime, so
the previewer renders it as a transform-only group (ADR-0008): its children still
show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `setting_count` | `1` | one solver chain on this node |
| `settings/0/target_node` | `NodePath("../../Target")` | the node the end bone reaches for |
| `settings/0/pole_node` | `NodePath("../../Pole")` | the node the pole is aimed at, fixing the elbow plane |
| `settings/0/root_bone_name` | `"UpperArm"` | shoulder joint, by name |
| `settings/0/root_bone` | `0` | the same joint as a bone index |
| `settings/0/middle_bone_name` | `"LowerArm"` | elbow joint, by name |
| `settings/0/middle_bone` | `1` | the same joint as a bone index |
| `settings/0/pole_direction` | `7` | Custom, so the pole uses an explicit vector |
| `settings/0/pole_direction_vector` | `Vector3(0, 0, 1)` | the custom pole axis on the middle bone |
| `settings/0/end_bone_name` | `"Hand"` | wrist joint, by name |
| `settings/0/end_bone` | `2` | the same joint as a bone index |
| `settings/0/use_virtual_end` | `false` | the end joint is a real bone, not one extended from the middle |
| `settings/0/extend_end_bone` | `true` | the end bone gets a tail, keeping the two keys below live |
| `settings/0/end_bone/direction` | `6` | FromParent, the tail direction |
| `settings/0/end_bone/length` | `0.1` | tail length in metres |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin TwoBoneIK3D -->
Strict parsing format-checks these `TwoBoneIK3D` properties, plus 1 inherited from IKModifier3D, 2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `setting_count` | integer >= 0 |  |
| `settings/*` | per-setting bone chain, pole direction and virtual end-bone setup |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
| `valid-twoboneik3d-settings` (type-family match) | `twoboneik3d-setting-index-out-of-range` | error |
|  | `twoboneik3d-pole-direction-vector-ignored` | error |
|  | `twoboneik3d-setting-missing-target-node` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, so it reads the node's transform and
nothing else: every `setting_count` and `settings/<i>/…` value above is dropped
rather than substituted, and no fallback value exists to name. Strict parsing is
where they are read at all, and only two of them can be wrong in a way that
still loads: `settings/<i>/pole_direction` outside `0-7` and
`settings/<i>/end_bone/direction` outside `0-6` are warnings, because Godot's
setters assign whatever integer they are handed and only the inspector dropdown
refuses it. The lenient parser reports neither.
