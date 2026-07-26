---
type: CSGCylinder3D
category: 3D
fixture: unit-csg-cylinder.tscn
image: unit-csg-cylinder
renders_as: a THREE.CylinderGeometry mesh
---

# CSGCylinder3D

A CSG cylinder primitive. The previewer draws it as a solid cylinder mesh, or a
cone when `cone` is set (top radius collapses to 0); CSG boolean ops are not
composed (ADR-0004).

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

## Linting

<!-- lint:begin CSGCylinder3D -->
Strict parsing format-checks these `CSGCylinder3D` properties, plus 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `cone` |
| `height` |
| `material` |
| `operation` |
| `radius` |
| `sides` |

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
with no warning. `operation` is read with `parseOptionalInt` (no warning either way)
and, when present and non-zero, only warns that the primitive still renders as a plain
union rather than an intersection or subtraction (ADR-0004); `material`, if present, is
copied through unvalidated.
