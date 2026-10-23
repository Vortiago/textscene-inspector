---
type: NavigationLink3D
category: 3D
status: linter-only
fixture: unit-navigation-link-3d.tscn
# image: unit-navigation-link-3d
visual: false
renders_as: nothing (a transform-only group)
---

# NavigationLink3D

Connects two positions on a navigation map so agents can path across a gap. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin NavigationLink3D -->
Strict parsing format-checks these `NavigationLink3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `bidirectional` | true or false |  |
| `enabled` | true or false |  |
| `end_position` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `enter_cost` | float >= 0 | error below |
| `navigation_layers` | 32-bit layer mask (layers 1-32) |  |
| `start_position` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `travel_cost` | float >= 0 | error below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-navigationlink3d-positions` | `navigationlink3d-start-position-equals-end-position` | warning |
<!-- lint:end -->

`index.ts` registers `parseNode3D`, which reads only `transform` and `visible`. A negative `enter_cost` or a non-boolean `enabled` parses and renders exactly like a good value, and only strict reports it.
