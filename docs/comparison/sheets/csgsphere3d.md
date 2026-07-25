---
type: CSGSphere3D
category: 3D
fixture: unit-csg-sphere.tscn
image: unit-csg-sphere
renders_as: a solid sphere mesh
---

# CSGSphere3D

A constructive-solid-geometry sphere primitive. The previewer draws it as a solid
sphere carrying its StandardMaterial3D. The CSG boolean `operation` IS applied
(ADR-0026), so a sphere inside a CSG root contributes to that root's result.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `radius` | `1.25` | the sphere's on-screen size, lifted to fill the upper frame |
| `radial_segments` | `48` | longitude divisions — smooth, facet-free silhouette |
| `rings` | `24` | latitude divisions — smooth top-to-bottom shading |
| `material` | `StandardMaterial3D` (`albedo_color` blue) | the blue surface colour |

## Divergences

None visible in this fixture.
