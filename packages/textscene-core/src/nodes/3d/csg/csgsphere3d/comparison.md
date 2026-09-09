---
type: CSGSphere3D
category: 3D
status: unreviewed
fixture: unit-csg-sphere.tscn
image: unit-csg-sphere
renders_as: a solid sphere mesh
---

# CSGSphere3D

A constructive-solid-geometry sphere. The previewer draws it as a solid sphere carrying its `StandardMaterial3D` and evaluates the boolean `operation` (ADR-0027), so a sphere inside a CSG root contributes to that root's result.

## Linting

<!-- lint:begin CSGSphere3D -->
Strict parsing format-checks these `CSGSphere3D` properties, plus 1 inherited from CSGPrimitive3D, 6 inherited from CSGShape3D, 18 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `material` | null, SubResource("id") or ExtResource("id") |  |
| `radial_segments` | integer 4-100 | error below, warning above |
| `radius` | float 0.001-100 | error at or below 0, warning below 0.001, warning above 100 |
| `rings` | integer 1-100 | error below, warning above |
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

The lenient parser falls back silently when a key is absent, and warns then falls back when it is unparseable: `radius` to `0.5`, `radial_segments` to `12`, `rings` to `6`. `operation` is read with `parseOptionalInt` and warns neither way, and `material` is copied through unvalidated.
