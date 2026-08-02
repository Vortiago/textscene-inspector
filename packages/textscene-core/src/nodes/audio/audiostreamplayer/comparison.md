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

AudioStreamPlayer plays a non-spatial audio stream and has no runtime visual. The
previewer draws nothing for it — reusing the base Node component with zero geometry
rather than a placeholder cube. The blue slab in both images is the fixture's `Ground`
StaticBody3D; the `Music` player is invisible in each.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `autoplay` | `true` | none — playback has no visual |
| `volume_db` | `-6.0` | none — audio level has no visual |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin AudioStreamPlayer -->
Strict parsing format-checks these `AudioStreamPlayer` properties, plus 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `autoplay` | true or false |
| `bus` | quoted string or &"name" |
| `max_polyphony` | integer >= 1 |
| `pitch_scale` | float > 0 |
| `playing` | true or false |
| `stream` | SubResource("id") or ExtResource("id") |
| `stream_paused` | true or false |
| `volume_db` | float |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-audiostreamplayer-properties` | `audiostreamplayer-missing-stream-resource` | error |
|  | `audiostreamplayer-autoplay-without-stream` | warning |
|  | `audiostreamplayer-extreme-volume` | warning |
<!-- lint:end -->

pitch_scale, volume_db, and the playing/autoplay/stream_paused flags fall back
silently to 1, 0, false, false, and false when absent, warning and reusing those
same defaults when present but unparseable; strict's positive-only check on
pitch_scale has no lenient counterpart beyond "is it a number". max_polyphony
behaves the same way, defaulting to 1 with no floor enforced (strict rejects
anything below 1). stream and bus get no format validation: stream is copied
through verbatim whenever present and left unset otherwise, and bus defaults to
"Master" only when absent, accepting whatever string is given (quotes or the
StringName `&` sigil stripped) with no warning.
