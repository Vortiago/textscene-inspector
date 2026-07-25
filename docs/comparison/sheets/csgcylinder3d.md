---
type: CSGCylinder3D
category: 3D
fixture: unit-csg-cylinder.tscn
image: unit-csg-cylinder
renders_as: a solid cylinder or cone mesh
---

# CSGCylinder3D

A CSG cylinder primitive, drawn as a solid cylinder or as a cone when `cone` is
set (top radius collapses to 0). The geometry is a port of Godot's own
`_build_brush`, not `THREE.CylinderGeometry`: three gives a collapsed cone apex
nine distinct radial normals where Godot's `smooth_faces` averages every face
meeting at one position into a single normal, which on a symmetric cone points
straight up. That difference alone was the whole of a 0.788% parity gap. CSG
boolean ops ARE composed (ADR-0026), so a cylinder inside a CSG root contributes
to that root's result.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `radius` | `0.5` / `0.4` | base radius of the pillar / cone |
| `height` | `2.0` / `1.0` | the tall pillar vs the shorter cone |
| `sides` | `16` | radial segments — a smooth silhouette with faint faceting |
| `cone` | `true` (Cone only) | collapses the top to a point, making a cone |
| `smooth_faces` | default `true` | one averaged normal at the cone apex, not nine radial ones |
| `material` | albedo `Color(0.6, 0.5, 0.2)` | the olive surface both shapes share |
| `transform` | `+1.5` on X (Cone) | offsets the cone to the right of the pillar |

## Divergences

None visible in this fixture. Measured at 0.052% against Godot 4.6.3 with
`pnpm ref:diff unit-csg-cylinder.tscn`, down from 0.788% before the normals port.
