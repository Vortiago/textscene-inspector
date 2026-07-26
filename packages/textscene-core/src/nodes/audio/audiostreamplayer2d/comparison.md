---
type: AudioStreamPlayer2D
category: 2D
fixture: unit-audio-stream-player-2d.tscn
image: unit-audio-stream-player-2d
visual: false
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

## Linting

<!-- lint:begin AudioStreamPlayer2D -->
Strict parsing format-checks these `AudioStreamPlayer2D` properties, plus 17 inherited from Node2D. Every validator failure is an **error**.

| Property |
| --- |
| `area_mask` |
| `attenuation` |
| `autoplay` |
| `bus` |
| `max_distance` |
| `max_polyphony` |
| `panning_strength` |
| `pitch_scale` |
| `playback_type` |
| `playing` |
| `stream` |
| `stream_paused` |
| `volume_db` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-audiostreamplayer2d-properties` | `audiostreamplayer2d-missing-stream` | error |
|  | `audiostreamplayer2d-missing-stream-resource` | error |
|  | `audiostreamplayer2d-autoplay-without-stream` | warning |
|  | `audiostreamplayer2d-zero-pitch-scale` | error |
|  | `audiostreamplayer2d-small-max-distance` | warning |
|  | `audiostreamplayer2d-large-max-distance` | warning |
|  | `audiostreamplayer2d-flat-attenuation` | warning |
|  | `audiostreamplayer2d-steep-attenuation` | warning |
|  | `audiostreamplayer2d-extreme-volume` | warning |
|  | `audiostreamplayer2d-unusual-pitch` | warning |
|  | `audiostreamplayer2d-invalid-max-polyphony` | error |
<!-- lint:end -->

Beyond the shared audio-base fallbacks (pitch_scale, volume_db, bus, and the
playing/autoplay/stream_paused flags, as in AudioStreamPlayer), max_distance
defaults to 2000, attenuation to 1, and panning_strength to 1 when absent,
warning and reusing those defaults only if the value fails to parse as a float;
strict's positive-only and 0-1 range checks on these three have no lenient
counterpart. area_mask defaults to 1 the same way; strict's bitmask validation
is not reproduced, so any parseable int is accepted. playback_type is the one
enum-shaped property here: unlike the plain floats, enumOr does enforce the
strict 0/1/2 membership check, falling back to `DEFAULT` (0) with a warning for
any value outside that set, not just an unparseable one.
