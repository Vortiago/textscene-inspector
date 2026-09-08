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

The base class every mesh-like 3D leaf inherits from. It gives them render layers and an AABB but draws nothing itself, so the previewer renders it as a transform-only group (ADR-0008).

## Linting

<!-- lint:begin VisualInstance3D -->
Strict parsing format-checks these `VisualInstance3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `layers` | 32-bit layer mask (layers 1-32) |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

A non-numeric or negative `layers` fails strict validation. The lenient parser (`parseNode3D`) never reads `layers`, so a bad value is ignored rather than substituted or reported.
