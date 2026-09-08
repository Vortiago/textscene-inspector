---
type: CollisionPolygon2D
category: 2D
status: linter-only
fixture: unit-collision-polygon-2d.tscn
# image: unit-collision-polygon-2d
visual: false
renders_as: nothing (a transform-only group)
---

# CollisionPolygon2D

Gives a polygon collision shape to a CollisionObject2D parent. Its outline is an editor and debug gizmo with no runtime visual, so the previewer renders it as a transform-only group (ADR-0008).

## Linting

<!-- lint:begin CollisionPolygon2D -->
Strict parsing format-checks these `CollisionPolygon2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `build_mode` | enum 0-1 (BUILD_SOLIDS/BUILD_SEGMENTS) | error |
| `disabled` | true or false |  |
| `one_way_collision` | true or false |  |
| `one_way_collision_margin` | float 0-128 | warning |
| `polygon` | PackedVector2Array(x, y, …) |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-collisionpolygon2d` | `collisionpolygon2d-no-parent` | warning |
|  | `collisionpolygon2d-invalid-parent` | warning |
|  | `collisionpolygon2d-empty-polygon` | warning |
|  | `collisionpolygon2d-insufficient-points` | warning |
|  | `collisionpolygon2d-one-way-ignored` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode2D`, so it never reads `build_mode`, `polygon`, `disabled`, `one_way_collision` or `one_way_collision_margin`. A malformed value passes through unexamined with no substitution.
