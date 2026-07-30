---
type: CSGTorus3D
category: 3D
fixture: unit-csg-torus.tscn
image: unit-csg-torus
renders_as: a solid torus mesh
---

# CSGTorus3D

Godot's constructive-solid-geometry torus: a ring lying in XZ with the hole on
+Y. The previewer builds it from a port of Godot's own `_build_brush`, not from
`THREE.TorusGeometry`, so the tessellation and the `smooth_faces` normals match
per vertex rather than merely per silhouette. The boolean `operation` IS
evaluated (ADR-0027), so a torus inside a CSG root contributes to that root's
result instead of drawing itself.

Two Godot details the fixture pins deliberately. `sides` counts segments around
the RING and `ring_sides` counts them around the TUBE, which is the opposite of
three's `radialSegments` / `tubularSegments` naming. And `smooth_faces` defaults
to `true` here, unlike CSGPolygon3D, where it defaults to `false`.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `inner_radius` / `outer_radius` (Ring) | `0.25` / `0.4` | the small ring; its Y extent is the tube radius, not the ring radius |
| `sides` / `ring_sides` (Ring) | `32` / `5` | coarse enough around the tube that no vertex lands at its top, so the Y extent is `tube * sin(72°)` |
| defaults (DefaultTorus) | none set | pins our `0.5 / 1.0 / 8 / 6 / true` against Godot's — the fat, smooth ring at centre |
| `smooth_faces` (FacetedTorus) | `false` | the flat-shaded ring at left, each quad its own plane normal |
| `transform` (TiltedTorus) | 45° about X | the only rotated CSG node in any fixture; it is what measures the TSCN basis convention (`basis_x/y/z` are matrix ROWS, not the columns Godot's C++ `Basis(x, y, z)` takes) |
| `material` | albedo `Color(0.55, 0.45, 0.2)` | the olive-gold surface all four share |

## Divergences

None visible in this fixture. Measured at 0.046% against Godot 4.6.3 with
`pnpm ref:diff unit-csg-torus.tscn`.

## Linting

<!-- lint:begin CSGTorus3D -->
Strict parsing format-checks these `CSGTorus3D` properties, plus 17 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 16 inherited from Node3D. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `flip_faces` | true or false |
| `inner_radius` | float > 0 |
| `material` | SubResource("id") or ExtResource("id") |
| `operation` | enum 0-2 (UNION/INTERSECTION/SUBTRACTION) |
| `outer_radius` | float > 0 |
| `ring_sides` | integer 3-64 |
| `sides` | integer 3-64 |
| `smooth_faces` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
<!-- lint:end -->

Strict rejects a non-positive `inner_radius` or `outer_radius`, and `sides` or
`ring_sides` outside 3 to 64, as errors. The lenient parser falls back silently when a
property is absent and warns then falls back when it is present but unparseable:
`inner_radius` to `0.5`, `outer_radius` to `1.0`, `sides` to `8`, `ring_sides` to `6`,
`smooth_faces` to `true` and `flip_faces` to `false`. Note that `smooth_faces` defaults
TRUE here and false on CSGPolygon3D, matching Godot. Equal radii are not an error on
either side: Godot returns an empty brush, and so do we. `material` and `operation` come
through the shared CSG tail, `material` copied unvalidated and `operation` read with
`parseOptionalInt` so it warns neither way.
