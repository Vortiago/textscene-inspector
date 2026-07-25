---
type: CSGCylinder3D
category: 3D
fixture: unit-csg-cylinder.tscn
image: unit-csg-cylinder
renders_as: a THREE.CylinderGeometry mesh
---

# CSGCylinder3D

A CSG cylinder primitive, drawn as a solid cylinder or as a cone when `cone` is
set (top radius collapses to 0). CSG boolean ops ARE composed (ADR-0026), so a
cylinder inside a CSG root contributes to that root's result.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `radius` | `0.5` / `0.4` | base radius of the pillar / cone |
| `height` | `2.0` / `1.0` | the tall pillar vs the shorter cone |
| `sides` | `16` | radial segments — a smooth silhouette with faint faceting |
| `cone` | `true` (Cone only) | collapses the top to a point, making a cone |
| `material` | albedo `Color(0.6, 0.5, 0.2)` | the olive surface both shapes share |
| `transform` | `+1.5` on X (Cone) | offsets the cone to the right of the pillar |

## Divergences

None visible in this fixture.
