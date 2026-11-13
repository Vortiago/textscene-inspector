---
type: Skeleton2D
category: 2D
renders_as: nothing itself, its modification stack poses its bones and its bones deform the Polygon2Ds bound to it
---

# Skeleton2D

Skeleton2D is the root of a Bone2D chain. It runs its `modification_stack` on the bones, as
Godot does each frame, and shows the pose the stack settles on. The children of a bone, its kite
and each Polygon2D that names the skeleton in `skeleton` follow that pose. A stack that is not
`enabled` leaves the bones where the scene or an AnimationPlayer put them. A `strength` below 1
moves each bone part of the way. A Skeleton2D below a Control solves in the space of the Control, with the rect the layout gave it.

## LookAt
<!-- compare: image=unit-skeleton2d-lookat status=done fixture=unit-skeleton2d-lookat.tscn -->

A `SkeletonModification2DLookAt` turns one bone at its target. The orange bar hangs on the bone
and points at the red target below it. The additional rotation and the angle constraint apply.

## TwoBoneIK
<!-- compare: image=unit-skeleton2d-twoboneik status=done fixture=unit-skeleton2d-twoboneik.tscn -->

A `SkeletonModification2DTwoBoneIK` bends two bones so that the second one ends on the red
target. The green strip is a Polygon2D skinned to both bones. A target out of reach straightens
the bones at it, and one too near folds them.

## Stack strength
<!-- compare: image=unit-skeleton2d-stack-strength status=done fixture=unit-skeleton2d-stack-strength.tscn -->

The TwoBoneIK scene with the `strength` of the stack at 0.5: each bone turns half way from its
own transform to the solved one.

## CCDIK
<!-- compare: image=unit-skeleton2d-ccdik status=done fixture=unit-skeleton2d-ccdik.tscn -->

A `SkeletonModification2DCCDIK` turns each joint in order until the tip node meets the red
target. A chain whose last bones fold onto one line bends to the side Godot bends it.

## FABRIK
<!-- compare: image=unit-skeleton2d-fabrik status=done fixture=unit-skeleton2d-fabrik.tscn -->

A `SkeletonModification2DFABRIK` moves the joints along the chain to the red target and back
to the root. The magnet position and the target rotation of a joint apply. A joint that names a
Bone2D of another skeleton moves that bone, and the bone of this skeleton at the same index takes
its transform.

## RemoteTransform2D below a bone
<!-- compare: image=unit-skeleton2d-remote-transform status=done fixture=unit-skeleton2d-remote-transform.tscn -->

A `RemoteTransform2D` below a bone pushes the pose the stack solves. Its target follows the
turned bone, so the green square stands at the end of the arm. The Cameras panel frames a Camera2D
below a bone at the solved bone too.

## Linting

<!-- lint:begin Skeleton2D -->
Strict parsing format-checks these `Skeleton2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `modification_stack` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
<!-- lint:end -->

Strict checks `modification_stack` for reference format only. The lenient parser reads it as a
resource reference, and a stack that does not decode leaves the bones unsolved.

## Known limitations

- **Needs runtime** A `SkeletonModification2DJiggle` springs its bones toward the target over time
  in Godot, and the previewer leaves them at their own transforms.
- **Needs runtime** A `SkeletonModification2DPhysicalBones` follows simulated PhysicalBone2D
  nodes, which the previewer does not simulate.
- **Needs runtime** A modification in the physics `execution_mode` moves no bone, where a running
  game applies it after each physics tick.
- **Approximated** The same readers solve from the bone transforms of the scene file, so a pose
  that an AnimationPlayer gives a bone does not reach them.
