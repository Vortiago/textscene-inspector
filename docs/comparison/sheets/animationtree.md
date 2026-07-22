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
The tree animates that box only when its row is selected and play is pressed
(Godot parity: a static capture has no game script and no selection, so nothing
moves). Both images therefore show the same unanimated box.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `active` | `true` | tree is allowed to process, but actuates only on select + play; no static visual |
| `tree_root` | `AnimationNodeBlendTree` | the blend program (spin + bob); reshapes the Mesh only during playback |
| `anim_player` | `NodePath("../AnimationPlayer")` | the driver whose clips it blends; no static effect |
| `parameters/blend/blend_amount` | `0.5` | 50/50 spin+bob mix, applied only while playing |

## Divergences

The bright sky/horizon band reads brighter and softer in Godot, blooming into
the sky above and the ground below; ours renders the same band dimmer with a
harder falloff. This fixture has no `WorldEnvironment`, so the reference is shot
with the editor preview environment (ADR-0025), whose glow (bloom) lifts the
scene's brightest region — an effect this previewer does not reproduce. The
white cube shows no halo at this brightness, so the gap is confined to the
horizon.
[PARITY-LIMITATIONS.md](../../PARITY-LIMITATIONS.md#preview-environment-glow)
