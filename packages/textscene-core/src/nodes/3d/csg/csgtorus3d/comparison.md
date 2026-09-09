---
type: CSGTorus3D
category: 3D
status: unreviewed
fixture: unit-csg-torus.tscn
image: unit-csg-torus
renders_as: a solid torus mesh
---

# CSGTorus3D

Godot's constructive-solid-geometry torus: a ring lying in XZ with the hole on +Y. The previewer builds it from a port of Godot's own `_build_brush`, so the tessellation and the `smooth_faces` normals match per vertex, and the boolean `operation` is evaluated (ADR-0027).

## Linting

<!-- lint:begin CSGTorus3D -->
Strict parsing format-checks these `CSGTorus3D` properties, plus 1 inherited from CSGPrimitive3D, 6 inherited from CSGShape3D, 18 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `inner_radius` | float >= 0.001 | warning below |
| `material` | null, SubResource("id") or ExtResource("id") |  |
| `outer_radius` | float >= 0.001 | warning below |
| `ring_sides` | integer 3-64 | error below, warning above |
| `sides` | integer 3-64 | error below, warning above |
| `smooth_faces` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-csgshape3d-own-geometry` (type-family match) | `csgmesh3d-requires-mesh` | info |
|  | `csgpolygon3d-insufficient-points` | info |
| `valid-geometryinstance3d-visibility-range` (type-family match) | `geometryinstance3d-visibility-range-end-before-begin` | warning |
|  | `geometryinstance3d-visibility-range-begin-fade-without-margin` | warning |
|  | `geometryinstance3d-visibility-range-end-fade-without-margin` | warning |
<!-- lint:end -->

The lenient parser falls back silently when a key is absent, and warns then falls back when it is unparseable. `inner_radius` falls back to `0.5`, `outer_radius` to `1.0`, `sides` to `8` and `ring_sides` to `6`. `smooth_faces` falls back to `true` and `flip_faces` to `false`. Equal radii are not an error on either side, since Godot returns an empty brush and so does the previewer. `operation` is read with `parseOptionalInt` and warns neither way.
