---
type: Line2D
category: 2D
fixture: unit-line2d.tscn
image: unit-line2d
renders_as: a stroked mesh polyline
---

# Line2D

Line2D strokes a chain of points at a fixed width; the previewer draws it as flat
mesh quads, one per segment, with sharp joint wedges filling the interior corners.
The fixture places two: a white diagonal bar and a closed blue-purple triangle.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `points` | 2-point / 3-point arrays | the diagonal bar and the triangle's three edges |
| `width` | `16` / `8` | stroke thickness of each line |
| `default_color` | white / `(0.5, 0.5, 1)` | the bar is white, the triangle blue-purple |
| `closed` | `true` (triangle) | wraps the third point back to the first, closing the outline |
| `position` | `(100,100)` / `(350,100)` | places the two lines side by side |

## Divergences

Position, width, cap shape, and closed-outline corners match Godot to within a
pixel, but the colours are dimmer and shifted. Godot draws pure white
`(255,255,255)` and blue-purple `(128,128,255)`; ours renders them as
`(226,226,226)` and `(149,143,226)`. See "Why 2D colours read paler in our captures" in docs/comparison/README.md.


## Linting

<!-- lint:begin Line2D -->
Strict parsing format-checks these `Line2D` properties, plus 18 inherited from Node2D. Every validator failure is an **error**.

| Property |
| --- |
| `closed` |
| `default_color` |
| `joint_mode` |
| `round_precision` |
| `sharp_limit` |
| `width` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

Strict rejects a non-numeric `width` or `sharp_limit`; the lenient parser warns and falls
back to `10` / `2` respectively. `closed` falls back to `false` on an unparseable bool, and
`round_precision` falls back to `8` on an unparseable int, each with a warning. `joint_mode`
is read with a plain int fallback (`0`) rather than the enum check strict applies, so an
out-of-range value (anything but `0`/`1`/`2`) is accepted silently, with no warning. A
malformed `default_color` falls back to white with no warning at all, since `parseColor`
swallows its own parse failures. Malformed `points` warn and leave the line with no points
(an empty array), the same fallback an absent `points` gets without a warning.
