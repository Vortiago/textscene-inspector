---
type: CSGCylinder3D
category: 3D
status: unreviewed
fixture: unit-csg-cylinder.tscn
image: unit-csg-cylinder
renders_as: a solid cylinder or cone mesh
---

# CSGCylinder3D

A CSG cylinder, drawn as a solid cylinder or as a cone when `cone` is set. The geometry is a port of Godot's own `_build_brush`, so the tessellation and the apex normals match, and the boolean `operation` is evaluated (ADR-0027).

## Linting

<!-- lint:begin CSGCylinder3D -->
Strict parsing format-checks these `CSGCylinder3D` properties, plus 1 inherited from CSGPrimitive3D, 6 inherited from CSGShape3D, 18 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `cone` | true or false |  |
| `height` | float >= 0.001 | warning below |
| `material` | null, SubResource("id") or ExtResource("id") |  |
| `radius` | float >= 0.001 | warning below |
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

The lenient parser falls back silently when a key is absent, and warns then falls back when it is unparseable: `radius` to `0.5`, `height` to `2.0`, `sides` to `8`. `cone` is a raw `=== 'true'` comparison, so any other value silently becomes `false`. `operation` is read with `parseOptionalInt` and warns neither way.
