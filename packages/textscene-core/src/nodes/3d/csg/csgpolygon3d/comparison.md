---
type: CSGPolygon3D
category: 3D
renders_as: a 2D profile swept into a solid
---

# CSGPolygon3D

A 2D profile swept into a 3D solid: extruded straight back (DEPTH), revolved about +Y (SPIN) or carried along a Path3D (PATH), chosen by `mode`. The previewer implements all three as a port of Godot's `_build_brush` and evaluates the boolean `operation` (ADR-0027).

## Extrusion (mode = DEPTH)
<!-- compare: image=unit-csg-polygon-depth status=done fixture=unit-csg-polygon-depth.tscn -->

The default mode. The profile sits at `z = 0` and extrudes toward -Z, so the solid spans `[-depth, 0]`. A wedge, a concave staircase, a smooth-walled blob and a default unit square all match.

## Revolution (mode = SPIN)
<!-- compare: image=unit-csg-polygon-spin status=done fixture=unit-csg-polygon-spin.tscn -->

The profile revolves about +Y. A quarter turn keeps both end caps, and a full 360 degrees closes the surface on itself with no caps at all, as in Godot.

## Path sweep (mode = PATH)
<!-- compare: image=unit-csg-polygon-path status=limitation fixture=unit-csg-polygon-path.tscn -->

The profile is carried along the `Path3D` named by `path_node`, resolved as a sibling or a child. The road and the rail follow their curves in both images.

- **Approximated** `path_rotation = 2` (PATH_FOLLOW) renders as PATH, so the profile does not tilt where the path banks.
- **Approximated** `path_rotation_accurate = true` renders as `false`.
- **Approximated** The curve is sampled at a fixed 16 segments per span rather than at `bake_interval`, so the extrusion count can differ by one on a tight span.

## Linting

<!-- lint:begin CSGPolygon3D -->
Strict parsing format-checks these `CSGPolygon3D` properties, plus 1 inherited from CSGPrimitive3D, 6 inherited from CSGShape3D, 18 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `depth` | float >= 0.01 | error below 0.001, warning below 0.01 |
| `material` | null, SubResource("id") or ExtResource("id") |  |
| `mode` | enum 0-2 (DEPTH/SPIN/PATH) | warning |
| `path_continuous_u` | true or false |  |
| `path_interval` | float >= 0.01 | warning below |
| `path_interval_type` | enum 0-1 (DISTANCE/SUBDIVIDE) | warning |
| `path_joined` | true or false |  |
| `path_local` | true or false |  |
| `path_node` | NodePath("path/to/node") |  |
| `path_rotation` | enum 0-2 (POLYGON/PATH/PATH_FOLLOW) | warning |
| `path_rotation_accurate` | true or false |  |
| `path_simplify_angle` | float 0-180 | warning |
| `path_u_distance` | float >= 0 | warning below |
| `polygon` | PackedVector2Array(x, y, …) |  |
| `smooth_faces` | true or false |  |
| `spin_degrees` | float 1-360 | error below 0.01, warning below 1, error above 360 |
| `spin_sides` | integer 3-64 | error below, warning above |

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

The lenient parser falls back silently when a key is absent, and warns then falls back when it is unparseable. A broken `polygon` yields the default unit square, and a broken `depth` its `1.0`. A `path_node` that resolves to no Path3D, or a curve with fewer than two points, renders empty on both sides and is reported by neither.
