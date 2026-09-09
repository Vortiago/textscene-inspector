---
type: AudioStreamPlayer
category: Other
status: linter-only
fixture: unit-physics-bodies.tscn
image: unit-physics-bodies
visual: false
renders_as: nothing (a non-spatial audio node)
---

# AudioStreamPlayer

Plays a non-spatial audio stream and has no runtime visual. The previewer draws nothing for it, reusing the base Node component. The blue slab in both images is the fixture's `Ground` StaticBody3D.

## Linting

<!-- lint:begin AudioStreamPlayer -->
Strict parsing format-checks these `AudioStreamPlayer` properties, plus 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `autoplay` | true or false |  |
| `bus` | quoted string or &"name" |  |
| `max_polyphony` | integer >= 1 | error below |
| `mix_target` | enum 0-2 (STEREO/SURROUND/CENTER) | warning |
| `pitch_scale` | float >= 0.01 | error at or below 0, warning below 0.01 |
| `playback_type` | enum 0-2 (DEFAULT/STREAM/SAMPLE) | warning |
| `playing` | true or false |  |
| `stream` | null, SubResource("id") or ExtResource("id") |  |
| `stream_paused` | true or false |  |
| `volume_db` | float -80-24 | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-audiostreamplayer-properties` | `audiostreamplayer-autoplay-without-stream` | info |
<!-- lint:end -->

`pitch_scale`, `volume_db` and the `playing`, `autoplay` and `stream_paused` flags fall back to 1, 0, false, false and false, with a warning when present but unparseable. `max_polyphony` defaults to 1 with no floor. `bus` defaults to `"Master"` only when absent and accepts any string with its quotes stripped.
