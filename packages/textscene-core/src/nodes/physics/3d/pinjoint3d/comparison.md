---
type: PinJoint3D
category: 3D
status: linter-only
fixture: unit-pin-joint-3d.tscn
# image: unit-pin-joint-3d
visual: false
renders_as: nothing (a transform-only group)
---

# PinJoint3D

Pins two 3D physics bodies together at a point. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin PinJoint3D -->
Strict parsing format-checks these `PinJoint3D` properties, plus 4 inherited from Joint3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `params/bias` | float 0.01-0.99 | warning |
| `params/damping` | float 0.01-8 | warning |
| `params/impulse_clamp` | float 0-64 | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-joint` (type-family match) | `joint-not-connected` | warning |
|  | `joint-same-body` | warning |
<!-- lint:end -->

The lenient parser applies no substitution. The base Node3D parse has no notion of the `params/*` bounds, so a negative `params/impulse_clamp` is stored verbatim and only `StrictTscnParser` reports it.
