---
type: CSGPolygon3D
category: 3D
renders_as: a 2D profile swept into a solid
---

# CSGPolygon3D

A 2D profile swept into a 3D solid. The sweep takes one of three shapes, chosen
by `mode`: extruded straight back (DEPTH), revolved about +Y (SPIN), or carried
along a Path3D's curve (PATH). All three are implemented, as a port of Godot's
`_build_brush` rather than via `THREE.ExtrudeGeometry` / `LatheGeometry`, both of
which get the axis and the caps wrong for this node. The boolean `operation` IS
evaluated (ADR-0027).

`smooth_faces` here defaults to `false`, the opposite of CSGTorus3D, and when it
is on it applies to the swept WALLS only: both end caps are always flat.

## Extrusion (mode = DEPTH)
<!-- compare: image=unit-csg-polygon-depth status=done fixture=unit-csg-polygon-depth.tscn -->

The default mode. The profile sits at `z = 0` and extrudes toward **-Z**, so the
solid spans `[-depth, 0]` rather than being centred on the origin — the single
most common thing to get wrong, and what `THREE.ExtrudeGeometry` would give as
`[0, depth]`.

| Property | Value | Effect |
| --- | --- | --- |
| `polygon` (Slope) | 3-point triangle | the wedge at left, extruded 2 units back |
| `polygon` (Staircase) | 10-point concave step profile | the stair block; concave, so a fan triangulation would fail on it |
| `depth` | `2.0` | how far each solid runs into the distance |
| `smooth_faces` (SmoothWall) | `true` | the rounded blob's walls shade smoothly while its caps stay flat |
| `polygon` (DefaultPolygon) | absent | pins our default `PackedVector2Array(0, 0, 0, 1, 1, 1, 1, 0)` and `depth = 1.0` against Godot's |

Measured at 0.021% against Godot 4.6.3.

## Revolution (mode = SPIN)
<!-- compare: image=unit-csg-polygon-spin status=done fixture=unit-csg-polygon-spin.tscn -->

The profile revolves about **+Y**, starting in XY and sweeping toward -Z. A
partial revolution builds both end caps; a full 360° builds **none** and snaps
the last frame back onto the first, so the surface closes on the same vertices
instead of merely meeting there.

| Property | Value | Effect |
| --- | --- | --- |
| `spin_degrees` (StaircaseSpin) | `90.0` | a quarter turn, so both end caps are present and visible |
| `spin_sides` (StaircaseSpin) | `32` | the smooth quarter-round sweep |
| `spin_degrees` (FullRevolution) | default `360` | the closed tube at right, with no caps at all |
| `spin_sides` (FullRevolution) | `24` | its radial tessellation |
| `smooth_faces` (FullRevolution) | `true` | smooth shading around the revolution |

Measured at 0.058% against Godot 4.6.3.

## Path sweep (mode = PATH)
<!-- compare: image=unit-csg-polygon-path status=limitation fixture=unit-csg-polygon-path.tscn -->

The profile is carried along a `Path3D` named by `path_node`. Because a component
cannot reach a sibling, the path is resolved in a post-parse pass over the whole
tree (the same shape `RemoteTransform3D` uses) and the resolved curve is written
onto the node as plain data, so the tree viewer, inspector, bounds and the
boolean evaluator all see it.

| Property | Value | Effect |
| --- | --- | --- |
| `path_node` (RoadTop) | `NodePath("../Path3D")` | a SIBLING reference, resolved relative to the node |
| `path_node` (Rail) | `NodePath("Path3D")` | a CHILD reference — the other witnessed shape |
| `path_interval` | `0.25` / `0.5` | how finely each sweep is sampled along the curve |
| `path_simplify_angle` (RoadTop) | `4.0` | drops a frame where the curve is near-straight |
| `path_rotation` | `1` (PATH) | the profile follows the curve's direction |
| `path_local` | `true` | the sweep is built in the polygon's own space |
| `path_continuous_u` / `path_u_distance` | `true` / `2.0` | U runs continuously along the road rather than resetting per segment |
| `smooth_faces` (RoadTop) | `true` | the road surface shades smoothly around its bends |

**Divergences.** Three approximations, each of which the fixture avoids
triggering but which a real scene can hit:

- `path_rotation = 2` (PATH_FOLLOW) renders as PATH. Faithful PATH_FOLLOW needs
  the curve's baked up-vectors (parallel transport plus per-point tilts), which
  our sampler does not carry. It diverges only where the path banks. It IS
  Godot's default, though neither vendored witness uses it.
- `path_rotation_accurate = true` renders as `false`.
- Godot bakes the curve at `Curve3D.bake_interval`; we tessellate at a fixed 16
  segments per span. Positions agree sub-millimetre on corpus curves, but the
  extrusion COUNT can differ by one on a tight span.

Measured at 0.078% against Godot 4.6.3. The residual is antialiasing along the
sweep's silhouette, not a shape difference.

## Linting

<!-- lint:begin CSGPolygon3D -->
Strict parsing format-checks these `CSGPolygon3D` properties, plus 17 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 16 inherited from Node3D. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `depth` | float > 0 |
| `flip_faces` | true or false |
| `material` | SubResource("id") or ExtResource("id") |
| `mode` | enum 0-2 (DEPTH/SPIN/PATH) |
| `operation` | enum 0-2 (UNION/INTERSECTION/SUBTRACTION) |
| `path_continuous_u` | true or false |
| `path_interval` | float > 0 |
| `path_interval_type` | enum 0-1 (DISTANCE/SUBDIVIDE) |
| `path_joined` | true or false |
| `path_local` | true or false |
| `path_node` | NodePath("path/to/node") |
| `path_rotation` | enum 0-2 (POLYGON/PATH/PATH_FOLLOW) |
| `path_rotation_accurate` | true or false |
| `path_simplify_angle` | float 0-180 |
| `path_u_distance` | float >= 0 |
| `polygon` | PackedVector2Array(x, y, …) — even count |
| `smooth_faces` | true or false |
| `spin_degrees` | float 1-360 |
| `spin_sides` | integer 3-64 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
<!-- lint:end -->

Strict is broadest here because the node has the largest property surface of any CSG
type: it rejects an odd-length or malformed `polygon`, a `mode` outside 0 to 2, a
non-positive `depth` or `path_interval`, `spin_degrees` outside 1 to 360, `spin_sides`
outside 3 to 64, `path_simplify_angle` outside 0 to 180, a negative `path_u_distance`,
and a `path_rotation` or `path_interval_type` outside its enum. The lenient parser falls
back silently when absent and warns then falls back when unparseable, so a broken
`polygon` yields the default unit square rather than nothing.

Two conditions neither side reports, because both are legitimate: a `path_node` that
resolves to no Path3D, and a PATH-mode polygon whose Curve3D has fewer than two points.
Each renders empty, exactly as Godot does. A Curve3D that Godot itself cannot load IS
reported, by the `curve3d-loadable` rule on the Path3D slice.
