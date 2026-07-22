---
type: AudioStreamPlayer2D
category: 2D
fixture: unit-audio-stream-player-2d.tscn
image: unit-audio-stream-player-2d
renders_as: an invisible Node2D transform group
---

# AudioStreamPlayer2D

A positional audio emitter. It has no runtime visual, so the previewer reuses the
Node2D transform-group Component (ADR-0008): an invisible group that positions its
children, drawing nothing itself. Both images are an empty scene.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `position` | `Vector2(120, 80)` | places the (invisible) emitter and its children; no mark of its own |
| `stream` | `AudioStreamGenerator` | the audio to play — inaudible and invisible in a still render |
| `volume_db` | `-6.0` | playback gain; no visible effect |
| `pitch_scale` | `1.2` | playback pitch; no visible effect |

## Divergences

None visible in this fixture.
