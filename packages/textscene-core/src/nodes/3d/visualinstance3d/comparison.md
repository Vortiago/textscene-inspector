---
type: VisualInstance3D
category: 3D
status: linter-only
fixture: unit-visual-instance-3d.tscn
# image: unit-visual-instance-3d
visual: false
renders_as: a transform-only group
---

# VisualInstance3D

The base class every mesh-ish 3D leaf (MeshInstance3D, GPUParticles3D, Sprite3D, Decal,
GridMap, the CSG shapes, …) inherits from — it gives them render layers and an AABB, but
draws nothing itself, so the previewer renders it as a transform-only group (ADR-0008):
its children still show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `layers` | `3` | sets the render-layer bitmask to layers 1+2; invisible here since the node draws nothing itself |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin VisualInstance3D -->
Strict parsing format-checks these `VisualInstance3D` properties, plus 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `layers` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
<!-- lint:end -->

A non-numeric or negative `layers` (e.g. `layers = abc` or `layers = -1`) fails strict
validation, but the lenient parser (`parseNode3D`) never reads `layers` at all — the
render layer bitmask has no effect on a node that draws nothing — so a bad value is
silently ignored rather than substituted or reported.
