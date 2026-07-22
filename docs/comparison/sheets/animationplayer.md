---
type: AnimationPlayer
category: 3D
fixture: unit-animation-player.tscn
image: unit-animation-player
renders_as: nothing itself; it drives other nodes' properties over time
---

# AnimationPlayer

Godot's keyframe animation driver. It has no visual of its own — it animates
other nodes' properties. The previewer plays its clips: select the player and
its transport (play / scrub / speed) appears, and the driven nodes move. Both
renders below play the autoplay clip **spin**, which rotates the box a full turn
about Y over two seconds; the frames are captured at the same times on each side.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `autoplay` | `spin` | the clip the transport starts on |
| clip `spin` | rotation Y `0 → 2π`, `length 2.0`, `loop` | the box turns once per loop |
| clip `bob` | position Y, `length 1.0`, `loop` | a second clip, selectable in the transport |

## Divergences

None visible in this fixture — the box rotates through the same angles on both
sides. The previewer does not autoplay on load (a static preview until you open
the Animation tab), whereas Godot's `autoplay` runs immediately; the GIFs here
drive both to the same frames so the motion matches.
