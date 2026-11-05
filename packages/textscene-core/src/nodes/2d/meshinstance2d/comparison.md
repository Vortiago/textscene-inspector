---
type: MeshInstance2D
category: 2D
status: unreviewed
fixture: unit-mesh-instance-2d.tscn
image: unit-mesh-instance-2d
renders_as: a THREE.Mesh, THREE.Points or THREE.LineSegments per surface kind
---

# MeshInstance2D

MeshInstance2D draws a Mesh on the canvas, textured through `texture`. The previewer draws each
surface at its vertices' x and y, with y down, and multiplies the texel, the vertex colour and the
modulate. The surfaces' own materials never apply.

## Linting

<!-- lint:begin MeshInstance2D -->
Strict parsing format-checks these `MeshInstance2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `mesh` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `texture` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
<!-- lint:end -->

A bare string in `mesh` or `texture`, such as `"res://quad.tres"`, is stored as-is with
no warning. The mesh then draws nothing, and the texture draws white.

## Known limitations

- **Approximated** A line is one device pixel wide, thinner than Godot's one viewport pixel on a
  display with a pixel ratio above 1.
