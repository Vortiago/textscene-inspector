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
Strict parsing format-checks these `CSGSphere3D` properties, plus 1 inherited from VisualInstance3D, 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `flip_faces` |
| `material` |
| `operation` |
| `radial_segments` |
| `radius` |
| `rings` |
| `smooth_faces` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
<!-- lint:end -->

Strict rejects a non-positive `radius`, or `radial_segments`/`rings` below 1, as
errors. The lenient parser falls back silently when absent, or warns and falls back
when present but unparseable: `radius` to `0.5`, `radial_segments` to `12`, `rings` to
`6`. `operation` is read separately with `parseOptionalInt` (no warning either way)
and, when present and non-zero, is applied by the boolean evaluator rather than dropped
(ADR-0027, superseding ADR-0004); `material`, if present, is copied through
unvalidated.
