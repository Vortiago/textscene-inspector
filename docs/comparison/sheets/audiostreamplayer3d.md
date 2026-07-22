---
type: AudioStreamPlayer3D
category: 3D
fixture: unit-audio-stream-player.tscn
image: unit-audio-stream-player
renders_as: a selection-gated speaker gizmo
---

# AudioStreamPlayer3D

A positional audio source with no runtime visual. The previewer draws an
editor-only speaker gizmo — a wireframe cone and baffle disk, plus an optional
range circle and emission cone — but gates all of it on selection, like the
Camera3D and light gizmos. Nothing is selected in a plain capture, so the three
speakers contribute nothing on screen; both images show only the grey ground
plane and the preview sky.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `stream` | `res://audio/test_sound.ogg` | the audio clip; never played, no visual |
| `bus` | `Master` / `SFX` / `Music` | routing only; not visible |
| `unit_size` | `5.0` / `8.0` | radius of the selection-gated range circle; gated, so not drawn |
| `max_distance` | `12.0` | clamps that range circle; gated |
| `attenuation_model` | `1` (inverse-square) | picks the range multiplier; gated |
| `emission_angle_enabled` | `true` | adds the selection-gated emission cone; gated |
| `emission_angle_degrees` | `30.0` | cone half-angle; gated |

## Divergences

None visible in this fixture.
