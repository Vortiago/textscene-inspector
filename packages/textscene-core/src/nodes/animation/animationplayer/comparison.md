---
type: AnimationPlayer
category: 3D
status: limitation
fixture: unit-animation-player.tscn
image: unit-animation-player
renders_as: no geometry of its own; a working driver of other nodes' properties
---

# AnimationPlayer

Godot's keyframe animation driver. It has no geometry of its own, but the
previewer plays its clips, so the comparison above is the animated pair
(`unit-animation-player.gif`): both sides step through one loop of the `spin`
clip and the box turns in each. The still frames beside it are the authored
rest pose — the capture harness stops every player before taking a still, so a
frozen frame is evidence of nothing either way.

Transform tracks run through a `THREE.AnimationMixer` rooted at `root_node`
(ADR-0011); value tracks reach non-transform properties like `Sprite2D:frame`
and `modulate` through a separate push registry (ADR-0016, ADR-0017).

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `autoplay` | `spin` | names the clip that would auto-run; the still shows the rest pose because the capture stops it |
| `speed_scale` | `1.0` | normal playback rate |
| `active` | `true` | the mixer applies its clips |
| `libraries/` | `bob`, `spin` | two clips are available to the transport |
| clip `spin` | rotation Y `0 → 2π`, `length 2.0`, `loop` | turns the box once per loop — the motion the GIF compares |
| clip `bob` | position Y `0.5 → 1.0 → 0.5`, `length 1.0`, `loop` | bobs the box up and down |

## Divergences

The `spin` loop matches across the compared frames — the box turns in step on
both sides, with no drift accumulating over the loop. What this fixture does
not exercise is where the real gaps are, so they are listed rather than shown:

- **Track types.** Only transform and value tracks play. `bezier`, `method`,
  `audio` and nested `animation` tracks are parsed and ignored (ADR-0011).
- **Interpolation.** Cubic interpolation (`interp = 2`) and per-keyframe
  `transition` easing are approximated as linear (ADR-0017), so an eased clip
  reaches the same poses on a slightly different curve.
- **Track binding is by name.** A track path is resolved against node names, so
  two same-named siblings under the animation root are ambiguous; a track that
  resolves above the root is dropped with a warning (ADR-0011).

## Linting

<!-- lint:begin AnimationPlayer -->
Strict parsing format-checks these `AnimationPlayer` properties, plus 13 inherited from AnimationMixer, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `autoplay` | quoted string or &"name" |  |
| `blend_times` | Array literal of (from, to, time) triples |  |
| `current_animation` | any value (no format constraint) |  |
| `method_call_mode` | enum 0-1 (DEFERRED/IMMEDIATE) | warning |
| `movie_quit_on_finish` | true or false |  |
| `next/*` | quoted string or &"name" |  |
| `playback/play` | any value (no format constraint) |  |
| `playback_active` | true or false |  |
| `playback_auto_capture` | true or false |  |
| `playback_auto_capture_duration` | float |  |
| `playback_auto_capture_ease_type` | enum 0-3 (IN/OUT/IN_OUT/OUT_IN) | warning |
| `playback_auto_capture_transition_type` | enum 0-11 (LINEAR/SINE/QUINT/QUART/QUAD/EXPO/ELASTIC/CUBIC/CIRC/BOUNCE/BACK/SPRING) | warning |
| `playback_default_blend_time` | float 0-4096 | warning |
| `playback_process_mode` | enum 0-2 (PHYSICS/IDLE/MANUAL) | warning |
| `speed_scale` | float |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-animationplayer-properties` | `animationplayer-autoplay-missing` | warning |
|  | `animationplayer-current-animation-missing` | error |
|  | `animationplayer-inactive` | info |
<!-- lint:end -->

`speed_scale` warns and falls back to `1.0` only when the value fails to parse
as a float, which is all strict checks too: the hint is open at both ends and the
setter is a bare assignment, so `0` and an extreme speed are both legal.
`playback_default_blend_time` falls back to `0.0` the same way; strict warns
rather than errors when it sits outside 0-4096. `callback_mode_process` and
`callback_mode_method` do re-enforce strict's enum membership through `enumOr`,
warning and substituting `IDLE` (1) or `DEFERRED` (0) for any value outside
`0`-`2`/`0`-`1`. `active` falls back to `true`, which is also Godot's default,
so an absent key means the mixer runs. Those three keys each have a deprecated
3.x spelling — `playback_process_mode`, `method_call_mode` and
`playback_active` — which Godot's `_set` forwards into the same setter
(animation_player.cpp:54-61), so the parser reads each pair into one field,
canonical key first, and strict format-checks both spellings independently
because either can appear in a file on disk. `autoplay` and
`current_animation` go through `stripQuotes`, which only strips
quote/StringName/NodePath sigil characters; an empty result is kept, and
strict accepts it too, because `set_autoplay` (animation_player.cpp:775)
assigns straight through and `""` is Godot's own "no autoplay" state.
`root_node` skips that helper entirely: absent, it defaults to the literal
`NodePath("..")`; present, the raw string is stored verbatim with no
quote-stripping, where strict checks the `NodePath("…")` grammar.
`current_animation_length` and `current_animation_position` fall back to
`0.0` on a parse failure and accept any value, including negative, matching
strict, which carries no validator for either: both are getter-only and
`PROPERTY_USAGE_NONE` in Godot (animation_player.cpp:1038-1039), so neither can
appear in a real `.tscn` and there is nothing to check.
