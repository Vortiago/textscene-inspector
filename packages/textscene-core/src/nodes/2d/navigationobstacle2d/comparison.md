---
type: NavigationObstacle2D
category: 2D
status: linter-only
fixture: unit-navigation-obstacle-2d.tscn
# image: unit-navigation-obstacle-2d
visual: false
renders_as: nothing (a transform-only group)
---

# NavigationObstacle2D

NavigationObstacle2D defines an avoidance and navmesh-carving region. It has no runtime
visual, so the previewer renders it as a transform-only group (ADR-0008).

## Linting

<!-- lint:begin NavigationObstacle2D -->
Strict parsing format-checks these `NavigationObstacle2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `affect_navigation_mesh` | true or false |  |
| `avoidance_enabled` | true or false |  |
| `avoidance_layers` | 32-bit layer mask (layers 1-32) |  |
| `carve_navigation_mesh` | true or false |  |
| `radius` | float 0-500 | error below, warning above |
| `velocity` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `vertices` | PackedVector2Array(x, y, …) |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-navigationobstacle2d` | `navigationobstacle2d-carve-without-affect` | info |
|  | `navigationobstacle2d-non-positive-global-scale` | warning |
|  | `navigationobstacle2d-non-uniform-global-scale` | warning |
|  | `navigationobstacle2d-global-skew-ignored` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode2D`, so `radius`, `vertices` and the avoidance keys
are never read into a typed field. A `radius` of `-1` or `9999` has no effect on the
render, and the raw string stays in `rawProperties`.
