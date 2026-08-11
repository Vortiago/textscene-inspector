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
(ADR-0027), so a sphere inside a CSG root contributes to that root's result.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `radius` | `1.25` | the sphere's on-screen size, lifted to fill the upper frame |
| `radial_segments` | `48` | longitude divisions — smooth, facet-free silhouette |
| `rings` | `24` | latitude divisions — smooth top-to-bottom shading |
| `material` | `StandardMaterial3D` (`albedo_color` blue) | the blue surface colour |

## Divergences

None visible in this fixture. Measured at 0.013% against Godot 4.6.3 with
`pnpm ref:diff unit-csg-sphere.tscn`.

## Linting

<!-- lint:begin CSGSphere3D -->
Strict parsing format-checks these `CSGSphere3D` properties, plus 18 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `flip_faces` | true or false |
| `material` | null, SubResource("id") or ExtResource("id") |
| `operation` | enum 0-2 (UNION/INTERSECTION/SUBTRACTION) |
| `radial_segments` | integer >= 4 |
| `radius` | float > 0 |
| `rings` | integer >= 1 |
| `smooth_faces` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-csgshape3d-own-geometry` (type-family match) | `csgmesh3d-requires-mesh` | warning |
|  | `csgpolygon3d-insufficient-points` | warning |
| `valid-geometryinstance3d-visibility-range` (type-family match) | `geometryinstance3d-visibility-range-end-before-begin` | warning |
|  | `geometryinstance3d-visibility-range-begin-fade-without-margin` | warning |
|  | `geometryinstance3d-visibility-range-end-fade-without-margin` | warning |
<!-- lint:end -->

Strict rejects a non-positive `radius`, or `radial_segments`/`rings` below 1, as
errors. The lenient parser falls back silently when absent, or warns and falls back
when present but unparseable: `radius` to `0.5`, `radial_segments` to `12`, `rings` to
`6`. `operation` is read separately with `parseOptionalInt` (no warning either way)
and, when present and non-zero, is applied by the boolean evaluator rather than dropped
(ADR-0027, superseding ADR-0004); `material`, if present, is copied through
unvalidated.
