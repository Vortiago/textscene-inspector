---
type: Sprite2D
category: 2D
fixture: unit-sprite2d.tscn
image: unit-sprite2d
renders_as: an unlit textured quad
---

# Sprite2D

Sprite2D draws a texture as a flat quad in the 2D canvas. The previewer renders each
one as an unlit, double-sided plane sized to the texture's pixel dimensions
(1 px = 1 unit), tinted by the CanvasItem `modulate`. The fixture scatters five markers
around the origin; three land inside the frame — the sprite at the origin (top-left
corner, only its lower-right quadrant on screen), one 140 px to the right, and one
140 px below. The flipped sprite (x = -140) and the rotated `Node2D` group's child
(world y ≈ -106) fall off the left and top edges.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `texture` | `ExtResource marker` | each sprite draws the 96×96 blue marker quad, centered on its position |
| `position` | `(140, 0)`, `(0, 140)` | places the right and below sprites; the unset Center stays at the origin |
| `modulate` | `Color(1, 0.5, 0.5, 1)` | red-tints the Below sprite — the one visible difference (below) |
| `flip_h` | `true` | set on the sprite at x = -140, which sits off the left edge — no visible effect here |

## Divergences

The red-modulated **Below** sprite renders markedly darker in ours than in Godot. On the
flat blue field the previewer shows `[22, 34, 111]` against Godot's `[45, 54, 112]` — red
and green come out roughly half of Godot's, while blue matches. The white marker on that
sprite likewise reads as a muddy dark salmon rather than Godot's brighter pink; it is the
same tint applied too dark, not a second defect. The two unmodulated sprites match (blue
field `[44, 115, 214]` vs `[45, 108, 223]`, a sub-10/255 round-trip shift), and every
sprite's position, size, and marker shape are pixel-aligned. No PARITY-LIMITATIONS entry
covers a `modulate` colour mismatch.
