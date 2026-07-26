---
type: Polygon2D
category: 2D
fixture: unit-polygon2d.tscn
image: unit-polygon2d
renders_as: a filled ShapeGeometry mesh
---

# Polygon2D

A filled 2D polygon on the canvas. The previewer triangulates the `polygon`
outline into an unlit, double-sided `ShapeGeometry` mesh and tints it with the
flat `color`. Both images draw the same home-plate pentagon at the same pixels.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `position` | `Vector2(112, 72)` | the outline's origin lands here — the shape's top-left corner sits at (112, 72) |
| `polygon` | `(0,0 128,0 128,96 64,160 0,96)` | the five-point outline: a 128×96 box tapering to a point at the bottom |
| `color` | `Color(1, 0.33, 0.61, 0.50)` | a semi-transparent pink fill, blended over the grey background |
| `antialiased` | `true` | smooth polygon edges — they read clean in both renders |

## Divergences

The 50%-alpha fill tint differs slightly: Godot reads a pinker
`rgb(166, 80, 116)`, ours a marginally more muted, purple-leaning
`rgb(160, 90, 124)` (a flat ~6–10/255 per-channel shift). The shape, size,
placement, and anti-aliased edge are pixel-identical; the gap is only in how the
translucent fill composites over the background.

## Linting

<!-- lint:begin Polygon2D -->
Strict parsing format-checks these `Polygon2D` properties, plus 15 inherited from Node2D. Every validator failure is an **error**.

| Property |
| --- |
| `antialiased` |
| `color` |
| `internal_vertex_count` |
| `invert_border` |
| `invert_enabled` |
| `offset` |
| `texture` |
| `texture_offset` |
| `texture_rotation` |
| `texture_scale` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

Strict rejects a non-numeric `internal_vertex_count` or `invert_border`; the lenient
parser warns and falls back to `0` / `100` respectively. `invert_enabled` falls back to
`false` on an unparseable bool, and an unparseable `offset` falls back to `(0, 0)`, both
with a warning. A malformed `color` falls back to white with no warning, since `parseColor`
swallows its own parse failures. `texture` is copied through unvalidated whenever present,
with no resource-reference check. `antialiased`, `texture_offset`, `texture_scale`, and
`texture_rotation` are format-checked by strict but never read by the lenient parser at
all, so no fallback applies; they have no effect on the render. Malformed `polygon` warns
and leaves the shape with no vertices; malformed `polygons` warns and degrades to no
sub-polygons, i.e. the polygon's stored vertex order.
