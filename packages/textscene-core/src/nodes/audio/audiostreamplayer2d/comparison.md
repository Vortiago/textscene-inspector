---
type: AudioStreamPlayer2D
category: 2D
status: linter-only
fixture: unit-audio-stream-player-2d.tscn
image: unit-audio-stream-player-2d
visual: false
renders_as: an invisible Node2D transform group
---

# AudioStreamPlayer2D

A positional audio emitter with no runtime visual. The previewer reuses the Node2D transform-group component (ADR-0008), which positions its children and draws nothing itself. Both images are an empty scene.

## Linting

<!-- lint:begin AudioStreamPlayer2D -->
Strict parsing format-checks these `AudioStreamPlayer2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `area_mask` | 32-bit layer mask (layers 1-32) |  |
| `attenuation` | float |  |
| `autoplay` | true or false |  |
| `bus` | quoted string or &"name" |  |
| `max_distance` | float >= 1 | error at or below 0, warning below 1 |
| `max_polyphony` | integer >= 1 | error below |
| `panning_strength` | float >= 0 | error below |
| `pitch_scale` | float >= 0.01 | error at or below 0, warning below 0.01 |
| `playback_type` | enum 0-2 (DEFAULT/STREAM/SAMPLE) | warning |
| `playing` | true or false |  |
| `stream` | null, SubResource("id") or ExtResource("id") |  |
| `stream_paused` | true or false |  |
| `volume_db` | float -80-24 | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-audiostreamplayer2d-properties` | `audiostreamplayer2d-autoplay-without-stream` | info |
<!-- lint:end -->

`max_distance` defaults to 2000, `attenuation` to 1 and `panning_strength` to 1 when absent. Those defaults are reused with a warning when the value fails to parse. `playback_type` re-checks the enum through `enumOr` and falls back to `DEFAULT` (0) for any value outside 0-2. Strict's floors on `max_distance` and `panning_strength` have no lenient counterpart.
