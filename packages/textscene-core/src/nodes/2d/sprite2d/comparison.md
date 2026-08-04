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

Colour diverges. The previewer dims the entire 2D output — no pixel in ours reaches pure
white, so the marker F's cap at a light grey `[226, 226, 226]` where Godot's white texels
render `[255, 255, 255]`. On the unmodulated blue field the shift is small (ours
`[44, 115, 214]` vs Godot `[45, 108, 223]`), but on the red-`modulate` **Below** sprite it
is stark: ours `[22, 34, 111]` against Godot `[45, 54, 112]` — red and green roughly half
of Godot's while blue matches — and its glyph reads a muddy salmon `[238, 151, 146]`
rather than Godot's brighter pink `[255, 128, 128]`. The Center sprite sets no `modulate`
yet still caps below white, so this is a pipeline-wide colour shift in the previewer's 2D
output; the Below sprite is that shift plus the tint multiply, not a separate
`modulate`-only defect.

## Linting

<!-- lint:begin Sprite2D -->
Strict parsing format-checks these `Sprite2D` properties, plus 12 inherited from Node2D, 15 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `centered` | true or false |
| `flip_h` | true or false |
| `flip_v` | true or false |
| `frame` | integer >= 0 |
| `frame_coords` | Vector2i(x, y), both >= 0 |
| `hframes` | integer 1-16384 |
| `offset` | Vector2(x, y) |
| `region_enabled` | true or false |
| `region_rect` | Rect2(x, y, w, h) |
| `texture` | SubResource("id") or ExtResource("id") |
| `vframes` | integer 1-16384 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-sprite2d-resources` | `sprite2d-requires-texture` | warning |
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
