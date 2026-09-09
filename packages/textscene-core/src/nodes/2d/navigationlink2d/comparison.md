---
type: NavigationLink2D
category: 2D
status: linter-only
fixture: unit-navigation-link-2d.tscn
# image: unit-navigation-link-2d
visual: false
renders_as: nothing (a transform-only group)
---

# NavigationLink2D

NavigationLink2D describes a shortcut between two points for the navigation server. It
draws nothing at runtime, so the previewer renders it as a transform-only group
(ADR-0008).

## Linting

<!-- lint:begin NavigationLink2D -->
Strict parsing format-checks these `NavigationLink2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `bidirectional` | true or false |  |
| `enabled` | true or false |  |
| `end_position` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `enter_cost` | float >= 0 | error below |
| `navigation_layers` | 32-bit layer mask (layers 1-32) |  |
| `start_position` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `travel_cost` | float >= 0 | error below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-navigationlink2d-endpoints` | `navigationlink2d-coincident-endpoints` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode2D`, which reads none of the seven link keys. A
malformed `enter_cost` or `navigation_layers` gets no warning and no fallback, since the
key is never read. Strict still checks every line.
