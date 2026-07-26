---
type: Polygon2D
category: 2D
fixture: unit-polygon2d.tscn
image: unit-polygon2d
renders_as: a filled, optionally textured mesh
---

# Polygon2D

A filled 2D polygon on the canvas. The previewer triangulates the outline into an
unlit, double-sided mesh holding **one vertex per authored polygon point**, tints
it with the flat `color`, and samples `texture` through the per-vertex `uv`. Both
images draw the same four polygons at the same pixels.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `position` | `Vector2(112, 72)` | the outline's origin lands here — the shape's top-left corner sits at (112, 72) |
| `polygon` | `(0,0 128,0 128,96 64,160 0,96)` | the five-point outline: a 128×96 box tapering to a point at the bottom |
| `color` | `Color(1, 0.33, 0.61, 0.50)` | a semi-transparent pink fill, blended over the grey background |
| `antialiased` | `true` | smooth polygon edges — they read clean in both renders |
| `texture` + `uv` | the marker PNG over `(0,0 64,0 64,64 0,64)` | the top-right quad samples the texture's top-left quarter, magnified 2× across a 128 px polygon |
| `material` (`blend_mode = 1`) | `CanvasItemMaterial` | the lower-left quad is ADDITIVE: its 34 %-alpha orange lightens the grey behind it instead of covering it |
| `vertex_colors` | red / green / blue / yellow | the lower-right quad interpolates a four-corner gradient across the triangulation |

The UV mapping is Godot's, ported from `scene/2d/polygon_2d.cpp`:
`uv' = texture_scale ⊙ (rot(v) + texture_offset) / texture_size`, with `v` the
authored texel UV where there is exactly one per vertex and the offset polygon
point otherwise. `Transform2D::scale` scales the origin along with the basis, so
`texture_scale` multiplies `texture_offset` too.

## Divergences

The whole frame matches to a mean channel error of 0.79/255.

The `vertex_colors` gradient is where the residue sits. Godot interpolates
per-vertex colour across the triangle in the sRGB values it was authored in;
three interpolates in the linear working space and encodes on output, so the
mid-gradient reads slightly differently even though all four corners agree. The
corners are exact; the largest deviation is on the diagonal between them.

`antialiased` has no equivalent and is ignored, which shows only as marginally
harder edges at this size.

## Linting

<!-- lint:begin Polygon2D -->
Strict parsing format-checks these `Polygon2D` properties, plus 17 inherited from Node2D. Every validator failure is an **error**.

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
| `uv` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

Strict rejects a non-numeric `internal_vertex_count` or `invert_border`; the lenient
parser warns and falls back to `0` / `100` respectively. `invert_enabled` falls back to
`false` on an unparseable bool, and an unparseable `offset`, `texture_offset` or
`texture_scale` falls back to `(0, 0)` / `(1, 1)`, all with a warning. A malformed
`color` falls back to white with no warning, since `parseColor` swallows its own parse
failures. `antialiased` is format-checked by strict but never read by the lenient parser,
so no fallback applies and it has no effect on the render. Malformed `polygon` warns and
leaves the shape with no vertices; malformed `polygons` warns and degrades to no
sub-polygons, i.e. the polygon's stored vertex order. A malformed `uv` or `vertex_colors`
warns and degrades to empty, which is exactly Godot's "sizes don't match" branch: the
point coordinates stand in for UVs and the flat `color` for per-vertex colours.
