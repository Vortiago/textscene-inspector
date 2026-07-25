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
evaluated (ADR-0026), so a torus inside a CSG root contributes to that root's
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
