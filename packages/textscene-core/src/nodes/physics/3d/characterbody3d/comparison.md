---
type: CharacterBody3D
category: 3D
status: linter-only
fixture: unit-characterbody3d.tscn
image: unit-characterbody3d
renders_as: a transform-only Node3D group
---

# CharacterBody3D

A physics body with no visual of its own. It renders as a transform-only group (ADR-0008), reusing the Node3D component. The blue capsule on screen is its child MeshInstance3D.

## Linting

<!-- lint:begin CharacterBody3D -->
Strict parsing format-checks these `CharacterBody3D` properties, plus 6 inherited from PhysicsBody3D, 6 inherited from CollisionObject3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `floor_block_on_wall` | true or false |  |
| `floor_constant_speed` | true or false |  |
| `floor_max_angle` | radians, 0° to 180° | warning |
| `floor_snap_length` | float >= 0 | error below |
| `floor_stop_on_slope` | true or false |  |
| `max_slides` | integer >= 1 | error below |
| `motion_mode` | enum 0-1 (GROUNDED/FLOATING) | warning |
| `platform_floor_layers` | 32-bit layer mask (layers 1-32) |  |
| `platform_on_leave` | enum 0-2 (ADD_VELOCITY/ADD_UPWARD_VELOCITY/DO_NOTHING) | warning |
| `platform_wall_layers` | 32-bit layer mask (layers 1-32) |  |
| `safe_margin` | float 0.001-256 | warning |
| `slide_on_ceiling` | true or false |  |
| `up_direction` | Vector3(x, y, z) other than the zero vector, or the Vector3i spelling Godot converts |  |
| `velocity` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `wall_min_slide_angle` | radians, 0° to 180° | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-collisionobject3d-scale` (type-family match) | `collisionobject3d-non-uniform-scale` | warning |
| `valid-characterbody3d` | `characterbody3d-floor-props-in-floating-mode` | info |
|  | `characterbody3d-slide-on-ceiling-in-floating-mode` | info |
| `valid-collisionobject3d` (type-family match) | `collisionobject3d-needs-collision-shape` | warning |
<!-- lint:end -->

CharacterBody3D reuses `parseNode3D` directly, so `motion_mode`, `velocity`, the floor and wall settings and `max_slides` are never read by the lenient parser. The node renders as an empty group, so no substitution is needed.
