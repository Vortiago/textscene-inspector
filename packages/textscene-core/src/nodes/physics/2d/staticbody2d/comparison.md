---
type: StaticBody2D
category: 2D
status: linter-only
fixture: unit-staticbody2d.tscn
visual: false
renders_as: a transform-only group
---

# StaticBody2D

A non-moving 2D physics body with no visual of its own. The previewer mounts it as a transform-only Node2D group (ADR-0008), so the capture shows its children only.

## Linting

<!-- lint:begin StaticBody2D -->
Strict parsing format-checks these `StaticBody2D` properties, plus 5 inherited from CollisionObject2D, 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `constant_angular_velocity` | float |  |
| `constant_linear_velocity` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `physics_material_override` | null, SubResource("id") or ExtResource("id") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-collisionobject2d` (type-family match) | `collisionobject2d-needs-collision-shape` | warning |
<!-- lint:end -->

Both collision keys go through `layerBitmask`, so a value outside a 32-bit mask is reported while any legal mask passes. The lenient parser keeps a malformed `position` as raw text rather than dropping the node.
