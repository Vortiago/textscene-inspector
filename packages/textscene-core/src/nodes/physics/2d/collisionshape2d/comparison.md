---
type: CollisionShape2D
category: 2D
status: unreviewed
fixture: unit-collisionshape2d.tscn
image: unit-collisionshape2d
visual: false
renders_as: a toggle-gated collision outline
---

# CollisionShape2D

Attaches a 2D collision shape to a physics body. Its outline is a debug gizmo gated behind "Visible Collision Shapes" (ADR-0005, ADR-0006), so a plain capture draws nothing.

## Linting

<!-- lint:begin CollisionShape2D -->
Strict parsing format-checks these `CollisionShape2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `debug_color` | Color(r, g, b, a) |  |
| `disabled` | true or false |  |
| `one_way_collision` | true or false |  |
| `one_way_collision_margin` | float 0-128 | warning |
| `shape` | null, SubResource("id") or ExtResource("id") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-collisionshape2d` | `collisionshape2d-requires-shape` | warning |
|  | `collisionshape2d-invalid-parent` | warning |
|  | `collisionshape2d-no-parent` | warning |
|  | `collisionshape2d-unused-one-way-margin` | info |
|  | `collisionshape2d-one-way-ignored-under-area2d` | warning |
|  | `collisionshape2d-polygon-shape-limited-editing` | warning |
<!-- lint:end -->

`shape` is copied through verbatim with no format check. `disabled` is `true` only for the literal string `true`. `debug_color` falls back to the project default `Color(0, 0.6, 0.7, 0.42)` for an absent or unparseable value, with no warning.

## Known limitations

- **Editor only** The shape outline draws only while the collision-shape toggle is on.
