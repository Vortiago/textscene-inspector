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

RetargetModifier3D copies the parent Skeleton3D's pose onto the Skeleton3D nodes placed
directly beneath it, remapping through a SkeletonProfile so two rigs with different rests
can share one animation. It draws nothing at runtime and moves only skeleton bones the
previewer does not pose, so it renders as a transform-only group (ADR-0008) and that
absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` | `Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)` | places the group one unit up; its children inherit the offset |
| `influence` | `0.75` | inherited from SkeletonModifier3D, blends the retargeted pose in at 75 percent, no visible mark |
| `profile` | `SubResource("SkeletonProfileHumanoid_ret1")` | the bone-name list matched between the two skeletons, no visible mark |
| `use_global_pose` | `false` | retargets in each bone's own space, which is what leaves `enable` live, no visible mark |
| `enable` | `3` | TRANSFORM_FLAG_POSITION and TRANSFORM_FLAG_ROTATION, scale left out, no visible mark |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin RetargetModifier3D -->
Strict parsing format-checks these `RetargetModifier3D` properties, plus 2 inherited from SkeletonModifier3D, 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `enable` | bit mask of TRANSFORM_FLAG_POSITION (1) | TRANSFORM_FLAG_ROTATION (2) | TRANSFORM_FLAG_SCALE (4) |
| `profile` | SubResource("id") or ExtResource("id") |
| `use_global_pose` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
| `valid-retargetmodifier3d-child-skeleton` (type-family match) | `retargetmodifier3d-no-child-skeleton` | warning |
<!-- lint:end -->

RetargetModifier3D has no `parser.ts` of its own: it registers `parseNode3D` directly
(index.ts), so `profile`, `use_global_pose` and `enable` are never read by the lenient
parser at all. A malformed value is dropped rather than substituted, and there is no
fallback to name, because nothing downstream of the parse consumes any of the three.

Two facts about `enable` the strict side reports and the sheet is the only place to
record. Its setter bare-assigns, so a bit past the three the inspector lists survives the
load and is merely unreachable from the editor, which is why an unlisted bit warns rather
than errors. And `_validate_property` withdraws `enable` from the property list entirely
while `use_global_pose` is true, so a hand-written scene carrying both keeps a value Godot
ignores and drops from the file on the next save. The linter does not report that pairing:
the value loads unaltered, and only a re-save through the editor makes it visible.
