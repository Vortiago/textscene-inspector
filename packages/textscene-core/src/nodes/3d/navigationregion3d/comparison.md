---
type: NavigationRegion3D
category: 3D
status: unreviewed
fixture: unit-navigation-region-3d.tscn
image: unit-navigation-region-3d
visual: false
renders_as: a translucent green navmesh overlay
---

# NavigationRegion3D

Holds a `NavigationMesh` describing walkable area. That mesh is navigation data with no game-runtime visual, and the previewer draws it as the editor's "Visible Navigation" overlay: translucent green faces with edge lines.

## Linting

<!-- lint:begin NavigationRegion3D -->
Strict parsing format-checks these `NavigationRegion3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `enabled` | true or false |  |
| `enter_cost` | float >= 0 | error below |
| `navigation_layers` | 32-bit layer mask (layers 1-32) |  |
| `navigation_mesh` | null, SubResource("id") or ExtResource("id") |  |
| `travel_cost` | float >= 0 | error below |
| `use_edge_connections` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-navigationregion3d-resources` | `navigationregion3d-requires-navigation-mesh` | warning |
<!-- lint:end -->

`navigation_mesh` is assigned straight from the raw property string with no format check, so a malformed reference strict rejects is stored as written and fails only in the downstream resource lookup.

## Known limitations

- **Editor only** Godot draws the navigation mesh only as an editor overlay, so the reference image shows none. Here the overlay is drawn by default.
