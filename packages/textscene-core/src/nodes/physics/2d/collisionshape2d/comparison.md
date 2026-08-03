---
type: CollisionShape2D
category: 2D
fixture: unit-collisionshape2d.tscn
image: unit-collisionshape2d
visual: false
renders_as: a toggle-gated collision outline
---

# CollisionShape2D

CollisionShape2D attaches a 2D collision shape to a physics body. It has no
runtime visual — its outline is a debug gizmo gated behind "Visible Collision
Shapes" (off by default, ADR-0005/0006), so a plain capture draws nothing.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `shape` | `RectangleShape2D` (40×60), `CircleShape2D` (r=15), `CapsuleShape2D` (r=10, h=30) | outline geometry of the gated gizmo; not drawn in a plain capture |
| `disabled` | `false` | shape stays active; no visual effect in a game render |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin CollisionShape2D -->
Strict parsing format-checks these `CollisionShape2D` properties, plus 12 inherited from Node2D, 15 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `debug_color` | Color(r, g, b, a) |
| `disabled` | true or false |
| `one_way_collision` | true or false |
| `one_way_collision_margin` | float >= 0 |
| `shape` | SubResource("id") or ExtResource("id") |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-collisionshape2d` | `collisionshape2d-requires-shape` | warning |
|  | `valid-collisionshape2d-resources` | error |
|  | `collisionshape2d-invalid-parent` | warning |
|  | `collisionshape2d-no-parent` | warning |
|  | `collisionshape2d-unused-one-way-margin` | warning |
<!-- lint:end -->

`shape` is copied through verbatim whenever present, with no format check, so
a malformed resource reference reaches the renderer unchanged. `disabled` is
set to `properties.disabled === 'true'`, so any non-`'true'` string
(including garbage) silently becomes `false`. `debug_color` goes through
`parseDebugColor`/`colorOr`, which falls back to the project default
`Color(0, 0.6, 0.7, 0.42)` for both an absent and an unparseable value, with
no warning either way. `one_way_collision` and `one_way_collision_margin` are
never read by the lenient parser; they only affect physics behaviour, not the
gizmo outline.
