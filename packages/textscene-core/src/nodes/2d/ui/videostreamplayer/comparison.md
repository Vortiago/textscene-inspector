---
type: VideoStreamPlayer
category: 2D
status: limitation
fixture: unit-video-stream-player-picture-size.tscn
image: unit-video-stream-player-picture-size
renders_as: a transparent rect at the Ogg Theora picture size, as in the Godot editor
---

# VideoStreamPlayer

A Control that plays a `VideoStream` and draws the decoded frame into its rect. With `expand` off its minimum size is the stream's Ogg Theora picture size (`video_stream_player.cpp:232-238`), which the previewer reads from the `.ogv` header. The editor never plays, so the node draws nothing and its children show over the picture-sized rect. A file with no Theora stream gives a minimum size of (0, 0).

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
| `stream` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `volume_db` | float -80-24 | error below, warning above |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

The lenient parser reads `stream` and `expand` on top of the Control parse, and ignores the other eight playback keys. A malformed `expand` reads as off.

## Known limitations

- **Needs runtime** Godot draws decoded frames only while a running game plays the stream.
