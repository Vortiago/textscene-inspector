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
