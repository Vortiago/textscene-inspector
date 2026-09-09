---
type: DampedSpringJoint2D
category: 2D
status: linter-only
fixture: unit-damped-spring-joint-2d.tscn
# image: unit-damped-spring-joint-2d
visual: false
renders_as: nothing (a transform-only group)
---

# DampedSpringJoint2D

Connects two 2D physics bodies with a spring-like force. Godot shows the spring only as an editor gizmo, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin DampedSpringJoint2D -->
Strict parsing format-checks these `DampedSpringJoint2D` properties, plus 4 inherited from Joint2D, 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `damping` | float 0.01-16 | warning |
| `length` | float 1-65535 | warning |
| `rest_length` | float 0-65535 | warning |
| `stiffness` | float 0.1-64 | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-joint` (type-family match) | `joint-not-connected` | warning |
|  | `joint-same-body` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode2D`, which reads only Node2D's own keys, so a malformed `stiffness` never reaches `node.properties`. Only the raw text survives on `node.rawProperties`.
