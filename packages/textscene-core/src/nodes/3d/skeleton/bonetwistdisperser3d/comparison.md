---
type: BoneTwistDisperser3D
category: 3D
status: linter-only
fixture: unit-bone-twist-disperser-3d.tscn
# image: unit-bone-twist-disperser-3d
visual: false
renders_as: nothing (a transform-only group)
---

# BoneTwistDisperser3D

A skeleton modifier that spreads one bone's twist back up its parent chain, so a
wrist rotation becomes a smooth spiral through the forearm instead of a single
sheared joint. It changes only the twist about each joint's own axis, never a
joint's global position, and it draws nothing at runtime, so the previewer
renders it as a transform-only group (ADR-0008): its children still show, and
that absence is the whole story.

Each entry in `settings` names a bone chain by its root and end bones, then picks
how the extracted twist is shared out along that chain: `Even` gives every joint
the same share, `Weighted` shares by bone length, and `Custom` takes an explicit
amount per joint or samples them from a damping curve.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `mutable_bone_axes` | `false` | joint axes come from the bone rests and are cached, not re-read per frame |
| `setting_count` | `2` | two independent bone chains on this node |
| `settings/0/root_bone_name` | `"UpperArm"` | top of the first chain, by name |
| `settings/0/root_bone` | `0` | the same joint as a bone index |
| `settings/0/end_bone_name` | `"Hand"` | bottom of the first chain, by name |
| `settings/0/end_bone` | `2` | the same joint as a bone index |
| `settings/0/extend_end_bone` | `true` | the end bone gets a tail, so it is the reference bone itself |
| `settings/0/end_bone_direction` | `6` | FromParent, the tail direction that fixes the twist axis |
| `settings/0/twist_from_rest` | `false` | twist is measured from an explicit pose, not from the bone rest |
| `settings/0/twist_from` | `Quaternion(0, 0.7071068, 0, 0.7071068)` | that explicit pose, a quarter turn about Y |
| `settings/0/disperse_mode` | `1` | Weighted, so shares follow bone length |
| `settings/0/weight_position` | `0.5` | each segment splits evenly between the joints at its ends |
| `settings/0/joint_count` | `3` | three joints in the first chain |
| `settings/1/root_bone_name` | `"UpperLeg"` | top of the second chain, by name |
| `settings/1/root_bone` | `3` | the same joint as a bone index |
| `settings/1/end_bone_name` | `"Foot"` | bottom of the second chain, by name |
| `settings/1/end_bone` | `5` | the same joint as a bone index |
| `settings/1/extend_end_bone` | `false` | no tail, so the reference bone is the end bone's parent |
| `settings/1/twist_from_rest` | `true` | twist is measured from the bone rest |
| `settings/1/disperse_mode` | `2` | Custom, so the per-joint amounts below are read |
| `settings/1/damping_curve` | `null` | no curve, so the amounts stay as written |
| `settings/1/joint_count` | `3` | three joints in the second chain |
| `settings/1/joints/0/twist_amount` | `0.25` | a quarter of the twist at the root joint |
| `settings/1/joints/1/twist_amount` | `0.75` | three quarters at the middle joint |

## Divergences

Nothing renders, so there is no image pair to diverge. Two behaviours are worth
naming because a scene file cannot show them:

- With `extend_end_bone` off, the last joint in a chain exists only to fix the
  twist axis, so its `twist_amount` has no effect at all and Godot hides the key.
  Setting 1 has three joints and two amounts for exactly that reason.
- A `damping_curve` supersedes the per-joint amounts: the curve is sampled across
  the chain and the sampled values are written back over `twist_amount`, which
  Godot then shows read-only. Both keys still get saved, so a file carrying the
  pair is normal rather than contradictory, and the amounts in it are outputs of
  the curve rather than inputs to the solver.

## Linting

<!-- lint:begin BoneTwistDisperser3D -->
Strict parsing format-checks these `BoneTwistDisperser3D` properties, plus 2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `mutable_bone_axes` | true or false |  |
| `setting_count` | integer >= 0 |  |
| `settings/*` | settings/<i>/<leaf> and settings/<i>/joints/<j>/<leaf> |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
| `valid-bonetwistdisperser3d-settings` (type-family match) | `bonetwistdisperser3d-setting-index-out-of-range` | error |
|  | `bonetwistdisperser3d-joint-index-out-of-range` | error |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, so it reads the node's transform and
nothing else: every `setting_count` and `settings/<i>/…` value above is dropped
rather than substituted, and no fallback value exists to name. Strict parsing is
where they are read at all.

Three of those keys are warnings rather than errors, because Godot's setters
assign whatever they are handed and only the inspector widget refuses the value:
`disperse_mode` outside `0-2`, `end_bone_direction` outside `0-6`, and
`weight_position` outside `0-1`. The per-joint `twist_amount` carries a range
hint too, but with both ends opened by `or_greater` and `or_less`, so no bound is
reportable and only its format is checked. Three further keys are refused
outright rather than bounded: `reference_bone_name` and the
`joints/<j>/bone_name` and `joints/<j>/bone` pair are derived readouts the class
never accepts a write for. The lenient parser reports none of it.
