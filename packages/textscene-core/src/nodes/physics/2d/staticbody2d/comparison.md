---
type: StaticBody2D
category: 2D
status: linter-only
fixture: unit-staticbody2d.tscn
visual: false
renders_as: a transform-only group
---

# StaticBody2D

A non-moving 2D physics body. It has no visual of its own in Godot either: the
previewer mounts it as a transform-only Node2D group (ADR-0008), so what the
capture shows is its children — a `CollisionShape2D` overlay, hidden unless
toggled on (ADR-0005/0006), and a blue `ColorRect`.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `position` | `Vector2(5, 5)` | places the body, and with it every child |
| `collision_layer` | `1` | the layers this body occupies |
| `collision_mask` | `1` | the layers it scans for contacts |

## Divergences

None. Nothing here draws, in Godot or in the previewer, and the physics the
properties describe is not simulated by either at load time.

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

Both collision keys go through `layerBitmask`, so a value outside a 32-bit mask
is reported while any legal mask passes untouched. The lenient parser keeps a
malformed `position` as its raw text rather than dropping the node, which is why
a typo in one body never costs you the rest of the scene tree.
