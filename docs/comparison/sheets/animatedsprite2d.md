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
