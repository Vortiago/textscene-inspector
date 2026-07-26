---
type: AnimationPlayer
category: 3D
fixture: unit-animation-player.tscn
image: unit-animation-player
renders_as: no visual of its own; an invisible driver of other nodes' properties
---

# AnimationPlayer

Godot's keyframe animation driver. It has no geometry — it animates other
nodes' properties over time. In a still capture there is nothing to draw for
the player itself, so both sides show the scene at its authored rest pose: the
`Mesh` box unrotated at its resting height. The motion of the `spin` clip is
documented separately as a GIF, not in this frame.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `autoplay` | `spin` | names the clip that would auto-run; the still shows the rest pose because the capture stops it |
| `speed_scale` | `1.0` | normal playback rate |
| `playback_active` | `true` | player marked active |
| `libraries/` | `bob`, `spin` | two clips are available to the transport |
| clip `spin` | rotation Y `0 → 2π`, `length 2.0`, `loop` | turns the box once per loop (not shown in this still) |
| clip `bob` | position Y `0.5 → 1.0 → 0.5`, `length 1.0`, `loop` | bobs the box up and down (not shown in this still) |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin AnimationPlayer -->
Strict parsing format-checks these `AnimationPlayer` properties. Every validator failure is an **error**.

| Property |
| --- |
| `autoplay` |
| `current_animation` |
| `current_animation_length` |
| `current_animation_position` |
| `method_call_mode` |
| `playback_active` |
| `playback_default_blend_time` |
| `playback_process_mode` |
| `root_node` |
| `speed_scale` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-animationplayer-properties` | `animationplayer-extreme-speed` | warning |
|  | `animationplayer-no-animations` | warning |
|  | `animationplayer-autoplay-missing` | warning |
|  | `animationplayer-current-animation-missing` | warning |
|  | `animationplayer-large-blend-time` | warning |
|  | `animationplayer-inactive` | warning |
|  | `animationplayer-invalid-root-path` | warning |
<!-- lint:end -->

`speed_scale` warns and falls back to `1.0` only when the value fails to parse
as a float; strict's zero-prohibition and `0.0001`-`1000` magnitude bounds have
no lenient counterpart, so `0` or an extreme speed plays through unchanged.
`playback_default_blend_time` falls back to `0.0` the same way, with no
negative-value check reproduced. `playback_process_mode` and
`method_call_mode` do re-enforce strict's enum membership via `enumOr`,
warning and substituting `IDLE` (1) or `DEFERRED` (0) for any value outside
`0`-`2`/`0`-`1`; `playback_active` falls back to `true`. `autoplay` and
`current_animation` go through `stripQuotes`, which only strips
quote/StringName/NodePath sigil characters and never rejects an empty result,
so strict's empty-string rejection has no lenient effect. `root_node` skips
that helper entirely: absent, it defaults to the literal `NodePath("..")`;
present, the raw string is stored verbatim with no quote-stripping and no
empty-string check, unlike strict's `nonEmptyQuotedString` validator.
`current_animation_length` and `current_animation_position` fall back to
`0.0` on a parse failure but accept a negative value with no warning, unlike
strict's `>= 0` check.
