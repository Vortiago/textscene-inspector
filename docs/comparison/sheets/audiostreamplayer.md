---
type: AudioStreamPlayer
category: Other
fixture: unit-physics-bodies.tscn
image: unit-physics-bodies
renders_as: nothing (a non-spatial audio node)
---

# AudioStreamPlayer

AudioStreamPlayer plays a non-spatial audio stream and has no runtime visual. The
previewer draws nothing for it — reusing the base Node component with zero geometry
rather than a placeholder cube. The blue slab in both images is the fixture's `Ground`
StaticBody3D; the `Music` player is invisible in each.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `autoplay` | `true` | none — playback has no visual |
| `volume_db` | `-6.0` | none — audio level has no visual |

## Divergences

None visible in this fixture.
