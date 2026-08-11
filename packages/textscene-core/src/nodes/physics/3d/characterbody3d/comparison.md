---
type: CharacterBody3D
category: 3D
status: linter-only
fixture: unit-characterbody3d.tscn
image: unit-characterbody3d
renders_as: a transform-only Node3D group
---

# CharacterBody3D

CharacterBody3D is a physics body with no visual of its own — it renders as a
transform-only group (ADR-0005, ADR-0008), reusing the Node3D component. The blue
capsule on screen is its child MeshInstance3D (a CapsuleMesh with a blue
StandardMaterial3D); the sibling CollisionShape3D is selection-gated and draws
nothing in a plain capture.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` | `origin (0, 0.8, 0)` | lifts the group so the capsule floats centered above the origin |
| `velocity` | `Vector3(0, 0, 0)` | runtime physics state; no visual effect in a static preview |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin CharacterBody3D -->
Strict parsing format-checks these `CharacterBody3D` properties, plus 6 inherited from CollisionObject3D, 17 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `floor_block_on_wall` | true or false |
| `floor_constant_speed` | true or false |
| `floor_max_angle` | radians, 0° to 180° |
| `floor_snap_length` | float >= 0 |
| `floor_stop_on_slope` | true or false |
| `max_slides` | integer > 0 |
| `motion_mode` | enum 0-1 (GROUNDED/FLOATING) |
| `platform_floor_layers` | 32-bit layer mask (layers 1-32) |
| `platform_on_leave` | enum 0-2 (ADD_VELOCITY/ADD_UPWARD_VELOCITY/DO_NOTHING) |
| `platform_wall_layers` | 32-bit layer mask (layers 1-32) |
| `safe_margin` | float |
| `slide_on_ceiling` | true or false |
| `up_direction` | Vector3(x, y, z) |
| `velocity` | Vector3(x, y, z) |
| `wall_min_slide_angle` | radians, 0° to 180° |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-collisionobject3d-scale` (type-family match) | `collisionobject3d-non-uniform-scale` | warning |
| `valid-characterbody3d` | `characterbody3d-needs-collision-shape` | warning |
|  | `characterbody3d-floor-props-in-floating-mode` | warning |
|  | `characterbody3d-safe-margin-too-small` | warning |
|  | `characterbody3d-safe-margin-too-large` | warning |
<!-- lint:end -->

CharacterBody3D has no `parser.ts` either: it reuses `parseNode3D` directly,
so none of the strict-validated properties (`motion_mode`, `velocity`, the
floor/wall/platform settings, `collision_layer`/`collision_mask`,
`max_slides`, `disable_mode`) are read by the lenient parser. The node
renders as an empty transform-only group, so no substitution is needed.
