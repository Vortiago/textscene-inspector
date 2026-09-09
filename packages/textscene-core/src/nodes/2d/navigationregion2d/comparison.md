---
type: NavigationRegion2D
category: 2D
status: unreviewed
fixture: unit-navigation-region-2d.tscn
image: unit-navigation-region-2d
visual: false
renders_as: a translucent green navigation-mesh overlay
---

# NavigationRegion2D

NavigationRegion2D holds a `NavigationPolygon` of walkable area. The previewer draws
that polygon as a translucent green fill with edge lines, gated on the `showNavigation`
toggle, which is on by default.

## Linting

<!-- lint:begin NavigationRegion2D -->
Strict parsing format-checks these `NavigationRegion2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `enabled` | true or false |  |
| `enter_cost` | float >= 0 | error below |
| `navigation_layers` | 32-bit layer mask (layers 1-32) |  |
| `navigation_polygon` | null, SubResource("id") or ExtResource("id") |  |
| `travel_cost` | float >= 0 | error below |
| `use_edge_connections` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-navigationregion2d-resources` | `navigationregion2d-requires-navigation-polygon` | warning |
<!-- lint:end -->

`navigation_polygon` has no fallback. The parser passes the raw reference string through
when present and leaves it `undefined` when absent, so a dangling reference draws no
mesh.

## Known limitations

- **Editor only** Godot's game render draws no navigation mesh, so the green overlay
  appears only here. Turning `showNavigation` off matches Godot.
