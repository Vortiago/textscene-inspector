---
type: AnimatedSprite2D
category: 2D
fixture: unit-animatedsprite2d.tscn
image: unit-animatedsprite2d
renders_as: a textured quad
---

# AnimatedSprite2D

AnimatedSprite2D plays a SpriteFrames animation. Playback is selection-driven
(ADR-0012), so in a plain capture the unselected node draws its authored clip's
current frame statically: the first `walk` frame (`dodge-walk1.png`) as a
textured quad, centered on the node's origin. That origin sits at the viewport's
top-left corner, so only the sprite's lower-right quadrant is on screen.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `sprite_frames` | embedded `SpriteFrames_walk` | supplies the `walk` clip's two frame textures |
| `animation` | `&"walk"` | selects that clip; its frame 0 (`dodge-walk1.png`) is what's drawn |

## Divergences

None visible in this fixture.
