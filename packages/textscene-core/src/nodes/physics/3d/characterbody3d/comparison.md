---
type: CharacterBody3D
category: 3D
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
Strict parsing format-checks these `CharacterBody3D` properties, plus 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `collision_layer` |
| `collision_mask` |
| `collision_priority` |
| `disable_mode` |
| `floor_block_on_wall` |
| `floor_constant_speed` |
| `floor_max_angle` |
| `floor_snap_length` |
| `floor_stop_on_slope` |
| `max_slides` |
| `motion_mode` |
| `platform_floor_layers` |
| `platform_on_leave` |
| `platform_wall_layers` |
| `safe_margin` |
| `up_direction` |
| `velocity` |
| `wall_min_slide_angle` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-characterbody3d` | `characterbody3d-needs-collision-shape` | warning |
|  | `characterbody3d-floor-snap-too-small` | warning |
|  | `characterbody3d-floor-snap-too-large` | warning |
|  | `characterbody3d-floor-props-in-floating-mode` | warning |
|  | `characterbody3d-zero-collision-layer` | warning |
|  | `characterbody3d-zero-collision-mask` | warning |
|  | `characterbody3d-non-standard-up-direction` | warning |
|  | `characterbody3d-max-slides-too-low` | warning |
|  | `characterbody3d-safe-margin-too-large` | warning |
<!-- lint:end -->

CharacterBody3D has no `parser.ts` either: it reuses `parseNode3D` directly,
so none of the strict-validated properties (`motion_mode`, `velocity`, the
floor/wall/platform settings, `collision_layer`/`collision_mask`,
`max_slides`, `disable_mode`) are read by the lenient parser. The node
renders as an empty transform-only group, so no substitution is needed.
