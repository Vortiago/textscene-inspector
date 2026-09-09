---
type: AudioStreamPlayer3D
category: 3D
status: unreviewed
fixture: unit-audio-stream-player.tscn
image: unit-audio-stream-player
renders_as: a selection-gated speaker gizmo
---

# AudioStreamPlayer3D

A positional audio source with no runtime visual. The previewer draws a speaker gizmo with a range circle and emission cone, gated on selection like the camera and light gizmos. Both images show only the ground plane and the preview sky.

## Linting

<!-- lint:begin AudioStreamPlayer3D -->
Strict parsing format-checks these `AudioStreamPlayer3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `area_mask` | 32-bit layer mask (layers 1-32) |  |
| `attenuation_filter_cutoff_hz` | float 1-20500 | warning |
| `attenuation_filter_db` | float -80-0 | warning |
| `attenuation_model` | enum 0-3 (INVERSE_DISTANCE/INVERSE_SQUARE_DISTANCE/LOGARITHMIC/DISABLED) | error |
| `autoplay` | true or false |  |
| `bus` | quoted string or &"name" |  |
| `doppler_tracking` | enum 0-2 (DISABLED/IDLE_STEP/PHYSICS_STEP) | warning |
| `emission_angle_degrees` | float 0.1-90 | error below 0, warning below 0.1, error above 90 |
| `emission_angle_enabled` | true or false |  |
| `emission_angle_filter_attenuation_db` | float -80-0 | warning |
| `max_db` | float -24-6 | warning |
| `max_distance` | float >= 0 | error below |
| `max_polyphony` | integer >= 1 | error below |
| `panning_strength` | float >= 0 | error below |
| `pitch_scale` | float >= 0.01 | error at or below 0, warning below 0.01 |
| `playback_type` | enum 0-2 (DEFAULT/STREAM/SAMPLE) | warning |
| `playing` | true or false |  |
| `stream` | null, SubResource("id") or ExtResource("id") |  |
| `stream_paused` | true or false |  |
| `unit_size` | float >= 0.1 | warning below |
| `volume_db` | float -80-80 | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-audiostreamplayer3d-properties` | `audiostreamplayer3d-emission-angle-not-enabled` | info |
|  | `audiostreamplayer3d-emission-filter-not-enabled` | info |
<!-- lint:end -->

Every numeric property defaults through `floatOr` without strict's range checks: `unit_size` falls back to 10, `max_distance` to 0, `attenuation_filter_cutoff_hz` to 5000 and `emission_angle_degrees` to 45. `attenuation_model` and `doppler_tracking` re-check the enum through `enumOr` and fall back to 0 for any out-of-range value.

## Known limitations

- **Editor only** The speaker gizmo draws only for the selected node, so a plain capture shows nothing for the three speakers.
