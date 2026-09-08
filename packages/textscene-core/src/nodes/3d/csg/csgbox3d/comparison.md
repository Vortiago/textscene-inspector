---
type: CSGBox3D
category: 3D
status: unreviewed
fixture: unit-csg-box.tscn
image: unit-csg-box
renders_as: a solid box mesh
---

# CSGBox3D

Godot's constructive-solid-geometry box. The previewer draws it as a box carrying its `StandardMaterial3D` and evaluates the boolean `operation` (ADR-0027), so a box inside a CSG root contributes to that root's result instead of drawing itself.

## Linting

<!-- lint:begin CSGBox3D -->
Strict parsing format-checks these `CSGBox3D` properties, plus 1 inherited from CSGPrimitive3D, 6 inherited from CSGShape3D, 18 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `material` | null, SubResource("id") or ExtResource("id") |  |
| `size` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |

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

The lenient parser keeps the default `size` of `(1, 1, 1)` when the key is absent, and warns and keeps that default when it is present but unparseable. `operation` is read with `parseOptionalInt`, so it warns neither way, and `material` is copied through unvalidated.
