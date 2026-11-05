---
type: MultiMeshInstance2D
category: 2D
status: unreviewed
fixture: unit-multi-mesh-instance-2d.tscn
image: unit-multi-mesh-instance-2d
renders_as: a THREE.Mesh, THREE.Points or THREE.LineSegments per surface kind, with every instance merged
---

# MultiMeshInstance2D

MultiMeshInstance2D draws the mesh of a MultiMesh once for each instance, on the canvas. The
previewer draws each instance under its 2D transform, and multiplies the texel, the vertex colour,
the instance colour and the modulate. With a CanvasItemMaterial that sets `particles_animation`,
each instance shows the cell its custom data picks. It draws nothing for a 3D transform format.

## Linting

<!-- lint:begin MultiMeshInstance2D -->
Strict parsing format-checks these `MultiMeshInstance2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `multimesh` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `texture` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
<!-- lint:end -->

A bare string in `multimesh` or `texture`, such as `"res://grass.tres"`, is stored as-is with
no warning. The MultiMesh then draws nothing, and the texture draws white.
