---
type: AnimationPlayer
category: 3D
fixture: unit-animation-player.tscn
image: unit-animation-player
renders_as: no visual of its own; an invisible driver of other nodes' properties
---

# AnimationPlayer

Godot's keyframe animation driver. It has no geometry — it animates other
nodes' properties over time. In a still capture there is nothing to draw for
the player itself, so both sides show the scene at its authored rest pose: the
`Mesh` box unrotated at its resting height. The motion of the `spin` clip is
documented separately as a GIF, not in this frame.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `autoplay` | `spin` | names the clip that would auto-run; the still shows the rest pose because the capture stops it |
| `speed_scale` | `1.0` | normal playback rate |
| `playback_active` | `true` | player marked active |
| `libraries/` | `bob`, `spin` | two clips are available to the transport |
| clip `spin` | rotation Y `0 → 2π`, `length 2.0`, `loop` | turns the box once per loop (not shown in this still) |
| clip `bob` | position Y `0.5 → 1.0 → 0.5`, `length 1.0`, `loop` | bobs the box up and down (not shown in this still) |

## Divergences

None visible in this fixture.
