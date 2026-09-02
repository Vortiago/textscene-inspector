---
type: AudioStreamPlayer3D
category: 3D
status: unreviewed
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
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-audiostreamplayer3d-properties` | `audiostreamplayer3d-emission-angle-not-enabled` | warning |
|  | `audiostreamplayer3d-emission-filter-not-enabled` | warning |
<!-- lint:end -->

Beyond the shared audio-base fallbacks, every numeric property here defaults via
`floatOr` without reproducing strict's range checks: unit_size falls back to 10
(strict only warns below the hint's 0.1, since the setter is a bare assignment),
max_distance to 0 with no non-negativity check,
attenuation_filter_cutoff_hz to 5000 with no 1-20500 range check, and
panning_strength/emission_angle_degrees to 1 and 45 with no 0-1/0-90 clamp.
attenuation_model and doppler_tracking are the two enums: `enumOr` does enforce
the strict 0-3/0-2 membership, warning and falling back to
`ATTENUATION_INVERSE_DISTANCE` and `DISABLED` (both 0) for any out-of-range
value, not just an unparseable one. area_mask defaults to 1 with no bitmask
validation, and emission_angle_enabled defaults to false.
