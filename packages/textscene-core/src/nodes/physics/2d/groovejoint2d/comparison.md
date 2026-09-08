---
type: GrooveJoint2D
category: 2D
status: linter-only
fixture: unit-groove-joint-2d.tscn
# image: unit-groove-joint-2d
visual: false
renders_as: nothing (a transform-only group, the groove is an editor gizmo)
---

# GrooveJoint2D

Restricts body B to sliding along a fixed axis from the joint's origin. Godot draws the groove only as a debug line, so the previewer renders it as a transform-only group (ADR-0008).

## Linting

<!-- lint:begin GrooveJoint2D -->
Strict parsing format-checks these `GrooveJoint2D` properties, plus 4 inherited from Joint2D, 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `initial_offset` | float 1-65535 | warning |
| `length` | float 1-65535 | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-joint` (type-family match) | `joint-not-connected` | warning |
|  | `joint-same-body` | warning |
<!-- lint:end -->

GrooveJoint2D registers `parseNode2D` directly, so `length` and `initial_offset` are never read. An out-of-range `length = 70000` or a non-numeric `initial_offset` is dropped rather than substituted or warned on.
