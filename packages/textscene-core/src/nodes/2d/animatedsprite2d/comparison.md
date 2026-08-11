---
type: AnimatedSprite2D
category: 2D
status: done
fixture: unit-animatedsprite2d.tscn
image: unit-animatedsprite2d
renders_as: a textured quad
---

# AnimatedSprite2D

AnimatedSprite2D plays a SpriteFrames clip. Playback is selection-driven
(ADR-0012): select the sprite and its transport advances the frame. Both images
here are GIFs of the `walk` clip playing — the Dodge character (drawn as a
textured quad centered and scaled 3x at the viewport centre) cycling its two
frames (`dodge-walk1`/`walk2`, legs together then splayed), driven to the same
frame at the same time on each side.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `position` | `Vector2(576, 324)` | centers the sprite in the 1152x648 viewport |
| `scale` | `Vector2(3, 3)` | enlarges the sprite 3x |
| `sprite_frames` | embedded `SpriteFrames_walk` | supplies the `walk` clip's two frame textures |
| `animation` | `&"walk"` | selects the `walk` clip |
| `frame` | `1` | the authored still frame; the transport plays the whole clip |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin AnimatedSprite2D -->
Strict parsing format-checks these `AnimatedSprite2D` properties, plus 18 inherited from Node2D. Every validator failure is an **error**.

| Property |
| --- |
| `animation` |
| `autoplay` |
| `centered` |
| `flip_h` |
| `flip_v` |
| `frame` |
| `frame_progress` |
| `offset` |
| `playing` |
| `speed_scale` |
| `sprite_frames` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-animatedsprite2d-resources` | `animatedsprite2d-requires-spriteframes` | warning |
|  | `valid-animatedsprite2d-resources` | error |
|  | `animatedsprite2d-autoplay-no-spriteframes` | warning |
|  | `animatedsprite2d-animation-no-spriteframes` | warning |
|  | `animatedsprite2d-speed-scale-zero` | warning |
|  | `animatedsprite2d-frame-progress-range` | warning |
|  | `animatedsprite2d-playing-deprecated` | warning |
<!-- lint:end -->

`speed_scale`, `frame_progress`, `autoplay`, and `playing` are validated by strict but never
read by the lenient parser at all; playback is selection-driven (see above), so these fields
have no lenient-side effect. `frame` uses `intOr` with a fallback of `0`: a non-numeric value
warns and renders frame 0, but a negative frame, which strict rejects, parses as a valid int
and is rendered as authored with no warning. `centered` defaults to `true`, `flip_h`/`flip_v`
default to `false`, and `offset` defaults to `(0, 0)`, each warning first if present but
malformed. `sprite_frames` is stored as-is when present and `animation` is unwrapped from its
`&"name"` StringName literal; neither is format-checked by the lenient parser.
