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

## Linting

<!-- lint:begin AudioStreamPlayer3D -->
Strict parsing format-checks these `AudioStreamPlayer3D` properties, plus 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `area_mask` |
| `attenuation_filter_cutoff_hz` |
| `attenuation_filter_db` |
| `attenuation_model` |
| `autoplay` |
| `bus` |
| `doppler_tracking` |
| `emission_angle_degrees` |
| `emission_angle_enabled` |
| `emission_angle_filter_attenuation_db` |
| `max_db` |
| `max_distance` |
| `max_polyphony` |
| `panning_strength` |
| `pitch_scale` |
| `playing` |
| `stream` |
| `stream_paused` |
| `unit_size` |
| `volume_db` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-audiostreamplayer3d-properties` | `audiostreamplayer3d-missing-stream` | error |
|  | `audiostreamplayer3d-missing-stream-resource` | error |
|  | `audiostreamplayer3d-invalid-unit-size` | error |
|  | `audiostreamplayer3d-invalid-max-distance` | error |
|  | `audiostreamplayer3d-invalid-pitch-scale` | error |
|  | `audiostreamplayer3d-emission-angle-not-enabled` | warning |
|  | `audiostreamplayer3d-emission-filter-not-enabled` | warning |
|  | `audiostreamplayer3d-extreme-volume` | warning |
|  | `audiostreamplayer3d-unusual-pitch` | warning |
|  | `audiostreamplayer3d-invalid-max-polyphony` | error |
<!-- lint:end -->

Beyond the shared audio-base fallbacks, every numeric property here defaults via
`floatOr` without reproducing strict's range checks: unit_size falls back to 10
with no positivity check, max_distance to 0 with no non-negativity check,
attenuation_filter_cutoff_hz to 5000 with no 1 Hz floor, and
panning_strength/emission_angle_degrees to 1 and 45 with no 0-1/0-90 clamp.
attenuation_model and doppler_tracking are the two enums: `enumOr` does enforce
the strict 0-3/0-2 membership, warning and falling back to
`ATTENUATION_INVERSE_DISTANCE` and `DISABLED` (both 0) for any out-of-range
value, not just an unparseable one. area_mask defaults to 1 with no bitmask
validation, and emission_angle_enabled defaults to false.
