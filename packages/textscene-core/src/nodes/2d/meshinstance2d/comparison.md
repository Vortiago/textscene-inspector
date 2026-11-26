---
type: MeshInstance2D
category: 2D
fixture: unit-mesh-instance-2d.tscn
image: unit-mesh-instance-2d
renders_as: a THREE.Mesh, THREE.Points or THREE.LineSegments per surface kind
---

# MeshInstance2D

MeshInstance2D draws a Mesh on the canvas, textured through `texture`. The previewer draws each
surface at its vertices' x and y, with y down, and multiplies the texel, the vertex colour and the
modulate. The surfaces' own materials never apply. A texture that is set but fails to load draws the untextured mesh, as Godot does. Godot's loader
leaves a property that names a missing file null (`resource_format_text.cpp:146-154`, `:288-289`). With a CanvasItemMaterial that sets
`particles_animation`, the mesh shrinks to one cell and shows cell 0.

## A user's canvas_item shader

<!-- compare: image=unit-canvas-shader-items status=done fixture=unit-canvas-shader-items.tscn -->

A MeshInstance2D can have a ShaderMaterial of `shader_type canvas_item` as its `material`. It then
draws each surface through Godot's canvas template with the user's shader, with the mesh's colours
and `uv`. A 2D light
does not shade it yet.

## A canvas_item shader's built-ins

<!-- compare: image=unit-canvas-shader-builtins status=done fixture=unit-canvas-shader-builtins.tscn -->

A user's `canvas_item` shader on a MeshInstance2D reads the mesh's `CUSTOM0` and `CUSTOM1` arrays. A lane the
array format lacks reads 0, and a missing alpha reads 1, as in Godot. A PRIMITIVE_POINTS mesh whose shader
writes `POINT_SIZE` draws each point as a square of that many pixels, with `POINT_COORD` across it. Sprite2D
rows beside them draw `world_vertex_coords`, `NORMAL`, `NORMAL_MAP`, `light_only`, a uniform at its default
and a shader that writes `POINT_SIZE` on a sprite. `SCREEN_UV`, `SCREEN_PIXEL_SIZE` and `FRAGCOORD` count the
pixels of Godot's viewport, the project window, not the previewer's canvas around it.

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
