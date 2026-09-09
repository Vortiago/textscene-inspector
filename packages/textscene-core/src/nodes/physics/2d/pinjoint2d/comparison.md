---
type: PinJoint2D
category: 2D
status: linter-only
fixture: unit-pin-joint-2d.tscn
# image: unit-pin-joint-2d
visual: false
renders_as: nothing (a transform-only group)
---

# PinJoint2D

Attaches two 2D physics bodies at a single point and lets them rotate freely. Godot shows joints only as an editor gizmo, so the previewer renders it as a transform-only group (ADR-0008).

## Linting

<!-- lint:begin PinJoint2D -->
Strict parsing format-checks these `PinJoint2D` properties, plus 4 inherited from Joint2D, 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `angular_limit_enabled` | true or false |  |
| `angular_limit_lower` | radians, -180° to 180° | warning |
| `angular_limit_upper` | radians, -180° to 180° | warning |
| `motor_enabled` | true or false |  |
| `motor_target_velocity` | float |  |
| `softness` | float 0-16 | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-joint` (type-family match) | `joint-not-connected` | warning |
|  | `joint-same-body` | warning |
<!-- lint:end -->

PinJoint2D reuses `parseNode2D` directly, so its own properties never reach the lenient parser. A bad `softness` is neither substituted nor defaulted, and only the strict parser reports it.
