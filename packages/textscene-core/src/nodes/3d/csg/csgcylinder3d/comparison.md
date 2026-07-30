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
boolean ops ARE composed (ADR-0027), so a cylinder inside a CSG root contributes
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

## Linting

<!-- lint:begin CSGCylinder3D -->
Strict parsing format-checks these `CSGCylinder3D` properties, plus 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `cone` |
| `flip_faces` |
| `height` |
| `material` |
| `operation` |
| `radius` |
| `sides` |
| `smooth_faces` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
<!-- lint:end -->

Strict rejects a non-positive `radius`/`height`, `sides` outside 3-64, or a non-boolean
`cone` as errors. The lenient parser falls back silently when absent, or warns and
falls back when present but unparseable: `radius` to `0.5`, `height` to `2.0`, `sides`
to `8`. `cone` skips that contract entirely: it's read as a raw `=== 'true'` string
comparison, so any non-`true` value (not just an absent one) silently becomes `false`
with no warning. `operation` is read with `parseOptionalInt`, so it warns neither way;
a non-zero value is applied by the boolean evaluator rather than dropped (ADR-0027,
superseding ADR-0004). `material`, if present, is copied through unvalidated.
