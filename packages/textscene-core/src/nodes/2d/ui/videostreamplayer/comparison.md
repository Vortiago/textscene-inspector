---
type: VideoStreamPlayer
category: 2D
status: unimplemented
fixture: unit-video-stream-player.tscn
# image: unit-video-stream-player
renders_as: nothing yet, an invisible Control-sized rect
---

# VideoStreamPlayer

A Control that plays a `VideoStream` and draws the decoded frame into its rect. The previewer draws no frame, so the node is an invisible transform-only fallback and its children still show.

## Linting

<!-- lint:begin VideoStreamPlayer -->
Strict parsing format-checks these `VideoStreamPlayer` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `audio_track` | integer 0-128 | warning |
| `autoplay` | true or false |  |
| `buffering_msec` | integer 10-1000 | warning |
| `bus` | quoted string or &"name" |  |
| `expand` | true or false |  |
| `loop` | true or false |  |
| `paused` | true or false |  |
| `speed_scale` | float >= 0 | error below |
| `stream` | null, SubResource("id") or ExtResource("id") |  |
| `volume_db` | float -80-24 | error below, warning above |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

The lenient parser reads VideoStreamPlayer through `parseControl`. It keeps the layout keys and ignores all ten playback keys, so a malformed `volume_db` is dropped with no fallback and no warning.

## Known limitations

- **Not drawn** Godot draws the video frame in the rect. Here the rect stays empty.
