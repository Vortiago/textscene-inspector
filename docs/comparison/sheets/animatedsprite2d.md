---
type: AnimatedSprite2D
category: 2D
fixture: unit-animatedsprite2d.tscn
image: unit-animatedsprite2d
renders_as: a textured quad
---

# AnimatedSprite2D

AnimatedSprite2D plays a SpriteFrames clip. Playback is selection-driven
(ADR-0012), so a plain capture shows the authored `frame` statically: here
frame 1 of the `walk` clip (`dodge-walk2.png`), the Dodge character, drawn as a
textured quad centered and scaled 3x at the viewport's center.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `position` | `Vector2(576, 324)` | centers the sprite in the 1152x648 viewport |
| `scale` | `Vector2(3, 3)` | enlarges the sprite 3x |
| `sprite_frames` | embedded `SpriteFrames_walk` | supplies the `walk` clip's two frame textures |
| `animation` | `&"walk"` | selects the `walk` clip |
| `frame` | `1` | pins the second frame (`dodge-walk2.png`), shown statically |

## Divergences

The sprite reads slightly flatter in the previewer. Its quad uses a tone-mapped
material, so the preview's tone-mapping compresses the texture's highlights (the
source's pure-white eye, `(255,255,255)`, renders at `(226,226,226)`) and nudges
the mid-tones, whereas Godot's 2D canvas blits the texel values unchanged.
Position, scale, and the displayed frame match.
