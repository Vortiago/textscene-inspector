---
type: AnimationTree
category: 3D
fixture: unit-animationtree-blend.tscn
image: unit-animationtree-blend
renders_as: an empty group (a non-visual driver)
---

# AnimationTree

AnimationTree is a non-visual node — it drives another node's clips through a
blend tree but draws no geometry of its own. The previewer mounts it as an empty
group, so the only thing on screen is the `Mesh` box at its authored transform.
A static preview never ticks the tree, and the reference harness deactivates it,
so both images show the same authored rest pose: an upright, axis-aligned box.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `tree_root` | `AnimationNodeBlendTree` | the blend program (spin + bob); reshapes the Mesh only during playback |
| `anim_player` | `NodePath("../AnimationPlayer")` | the driver whose clips it blends; no static effect |
| `active` | `true` | tree may process, but a static preview never runs it; no visual |
| `parameters/blend/blend_amount` | `0.5` | 50/50 spin+bob mix, applied only while playing |

## Divergences

None visible in this fixture.
