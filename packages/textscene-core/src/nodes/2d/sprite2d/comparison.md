---
type: Sprite2D
category: 2D
fixture: unit-sprite2d.tscn
image: unit-sprite2d
renders_as: an unlit textured quad
---

# Sprite2D

Sprite2D draws a texture as a flat quad on the 2D canvas. The previewer renders each one
as an unlit, double-sided plane sized to the texture's pixel dimensions (1 px = 1 unit),
tinted by the CanvasItem `modulate`. The fixture centres a `Node2D` in the 1152×648
viewport and scatters five markers around it, so all five are on screen: a centre marker,
one 140 px to its right, one 140 px to its left (flipped), one 140 px below (red-tinted),
and a fifth carried by a rotated `Node2D` group above and to the right.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `texture` | `ExtResource marker` | each sprite draws the 96×96 blue marker quad, centred on its node position |
| `position` | `(140, 0)`, `(0, 140)`, `(-140, 0)`, `(70, 0)` | offsets the four outer markers around the centred origin; the unset Center stays at `(0, 0)` |
| `modulate` | `Color(1, 0.5, 0.5, 1)` | red-tints the Below sprite (green and blue halved) |
| `flip_h` | `true` | mirrors the left marker horizontally — its F reads backwards |
| `rotation` | `0.5` | set on the Group `Node2D`; tilts its child sprite ~29° (the upper marker), inherited from the parent |

## Divergences

Placement, size, `flip_h`, and `rotation` agree pixel-for-pixel: the five markers land in
the same spots at the same size, the left marker's F is mirrored in both, and the group
child is tilted identically.

Colour agrees too. `pnpm ref:godot scenes/fixtures/unit-sprite2d.tscn --mode 2d`
against `pnpm ref:ours unit-sprite2d.tscn --2d` differs by 0 px at the harness
threshold. The marker's white texels reach pure `rgb(255, 255, 255)` on both sides,
over the same 3289 px in the same box (`x 415..736, y 181..351`); the unmodulated
blue field is `rgb(45, 108, 223)` on both; the `modulate = Color(1, 0.5, 0.5)`
**Below** sprite's glyph is `rgb(255, 128, 128)` on both; the backdrop is
`rgb(76, 76, 76)` on both.

Two residuals remain, both sub-perceptual. The **Below** sprite's tinted field reads
`rgb(45, 54, 112)` in Godot against `rgb(45, 50, 111)` here — 4/255 of green over
its 8162 px, the tint multiply rounding a step low. And the rotated
`Group/ChildSprite`'s antialiased edge parts by more than 8/255 on 299 px, three
per row down its 131-row diagonal, where the two rasterisers place the same edge
in adjacent columns.

## Linting

<!-- lint:begin Sprite2D -->
Strict parsing format-checks these `Sprite2D` properties, plus 18 inherited from Node2D. Every validator failure is an **error**.

| Property |
| --- |
| `centered` |
| `flip_h` |
| `flip_v` |
| `frame` |
| `frame_coords` |
| `hframes` |
| `offset` |
| `region_enabled` |
| `region_rect` |
| `texture` |
| `vframes` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-sprite2d-resources` | `sprite2d-requires-texture` | error |
|  | `valid-sprite2d-resources` | error |
|  | `sprite2d-frame-range` | warning |
|  | `sprite2d-frame-coords-range` | warning |
|  | `sprite2d-region-configuration` | warning |
<!-- lint:end -->

`hframes` and `vframes` fall back to `1` when absent or unparseable, and a parsed
value below `1` (e.g. `0` or negative) is silently clamped up to `1` via
`Math.max`. `frame` falls back to `0` but is otherwise unclamped, so a negative
frame index passes through unchanged where strict rejects it. `frame_coords` and
`region_rect` use their own inline parsers: a value that fails the `Vector2i` /
`Rect2` grammar warns and leaves the property `undefined`, but one that parses
cleanly is accepted even with negative components. Strict's `vector2i(_, true)`
validator rejects a negative `frame_coords`, but `rect2` only checks the
four-float format and does not reject a negative width or height on
`region_rect` either. `texture` is stored as whatever string is present, with no
resource-reference format check.
