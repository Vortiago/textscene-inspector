---
type: VideoStreamPlayer
category: 2D
status: unimplemented
fixture: unit-video-stream-player.tscn
# image: unit-video-stream-player
renders_as: nothing yet, an invisible Control-sized rect
---

# VideoStreamPlayer

A Control that plays a VideoStream and draws the decoded frame into its own rect,
stretched to the control size when `expand` is set and at the frame's native size
otherwise. The previewer parses and validates it but draws no frame, so it renders as
an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `stream` | `ExtResource("1_video")` | the VideoStream whose frames fill the rect |
| `audio_track` | `1` | plays the second embedded audio track |
| `volume_db` | `-6.0` | halves the playback volume |
| `speed_scale` | `1.5` | plays at one and a half times normal speed |
| `autoplay` | `true` | playback starts when the scene enters the tree |
| `paused` | `true` | so it holds on the first frame instead of running |
| `expand` | `true` | the frame stretches to the 320x180 rect the offsets give it |
| `loop` | `true` | restarts at the end instead of emitting `finished` once |
| `buffering_msec` | `250` | quarter of a second of audio held in the resampler |
| `bus` | `&"Master"` | the audio bus the video's sound mixes into |

## Divergences

Not captured yet.

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
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

The lenient parser reads VideoStreamPlayer through `parseControl`, so it takes the
layout keys and ignores all ten playback keys entirely: there is no substitution to
report, because nothing downstream consumes them. Strict is the only side that looks
at them. Two of the eleven values a `.tscn` might plausibly carry are checked
nowhere at all, and deliberately: `volume` and `stream_position` are bound
`PROPERTY_USAGE_NONE`, so Godot never writes either one, and a validator for them
would guard a key that cannot appear. The one place strict is knowingly lenient is
the bottom of the `volume_db` range: it errors below -80, while Godot in fact
collapses anything below -79 to silence, so a hand-written `volume_db = -79.5`
passes here and loads as -80 there.
