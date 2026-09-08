---
type: NavigationObstacle3D
category: 3D
status: linter-only
fixture: unit-navigation-obstacle-3d.tscn
image: unit-navigation-obstacle-3d
visual: false
renders_as: a transform-only group (no runtime visual)
---

# NavigationObstacle3D

Defines an avoidance region for navigation agents. It has no runtime visual, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin NavigationObstacle3D -->
Strict parsing format-checks these `NavigationObstacle3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `affect_navigation_mesh` | true or false |  |
| `avoidance_enabled` | true or false |  |
| `avoidance_layers` | 32-bit layer mask (layers 1-32) |  |
| `carve_navigation_mesh` | true or false |  |
| `height` | float 0-100 | error below, warning above |
| `radius` | float 0-100 | error below, warning above |
| `use_3d_avoidance` | true or false |  |
| `velocity` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `vertices` | PackedVector3Array(x, y, z, …) |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-navigationobstacle3d` | `navigationobstacle3d-carve-without-affect` | info |
<!-- lint:end -->

The seven scalar and flag keys (`radius`, `height`, `avoidance_enabled`, `avoidance_layers`, `affect_navigation_mesh`, `carve_navigation_mesh`, `use_3d_avoidance`) use the optional readers, so an absent or unparseable value leaves the property unset silently. A negative `radius` passes through unchanged, and `vertices` and `velocity` are never read.
