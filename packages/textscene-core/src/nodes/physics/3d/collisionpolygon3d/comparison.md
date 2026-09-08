---
type: CollisionPolygon3D
category: 3D
status: linter-only
fixture: unit-collision-polygon-3d.tscn
# image: unit-collision-polygon-3d
visual: false
renders_as: nothing (a transform-only group)
---

# CollisionPolygon3D

Gives a CollisionObject3D parent a prism collision shape extruded from a 2D polygon. That shape is editor and debug visualisation only, so the previewer renders it as a transform-only group (ADR-0008).

## Linting

<!-- lint:begin CollisionPolygon3D -->
Strict parsing format-checks these `CollisionPolygon3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `debug_color` | Color(r, g, b, a) |  |
| `debug_fill` | true or false |  |
| `depth` | float |  |
| `disabled` | true or false |  |
| `margin` | float 0.001-10 | warning |
| `polygon` | PackedVector2Array(x, y, …) |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-collisionpolygon3d` | `collisionpolygon3d-no-parent` | warning |
|  | `collisionpolygon3d-invalid-parent` | warning |
|  | `collisionpolygon3d-empty-polygon` | warning |
|  | `collisionpolygon3d-non-uniform-scale` | warning |
<!-- lint:end -->

`polygon`, `depth`, `margin`, `disabled`, `debug_color` and `debug_fill` are never read by the lenient parser, which reuses `parseNode3D` wholesale. A malformed value lints only through the strict validators.
