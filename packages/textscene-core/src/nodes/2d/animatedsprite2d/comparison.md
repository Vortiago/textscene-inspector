---
type: AnimatedSprite2D
category: 2D
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

The sprite reads slightly flatter in the previewer. Its quad uses a tone-mapped
material, so the preview's tone-mapping compresses the texture's highlights (the
source's pure-white eye, `(255,255,255)`, renders at `(226,226,226)`) and nudges
the mid-tones, whereas Godot's 2D canvas blits the texel values unchanged.
Position, scale, and the played frames match at each moment of the clip.

## Linting

<!-- lint:begin AnimatedSprite2D -->
Strict parsing format-checks these `AnimatedSprite2D` properties, plus 12 inherited from Node2D, 15 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `animation` | any value (no format constraint) |
| `autoplay` | any value (no format constraint) |
| `centered` | true or false |
| `flip_h` | true or false |
| `flip_v` | true or false |
| `frame` | integer >= 0 |
| `frame_progress` | float |
| `offset` | Vector2(x, y) |
| `playing` | true or false |
| `speed_scale` | float |
| `sprite_frames` | SubResource("id") or ExtResource("id") |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-animatedsprite2d-resources` | `animatedsprite2d-requires-spriteframes` | error |
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
