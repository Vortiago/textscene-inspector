---
type: RigidBody2D
category: 2D
status: linter-only
fixture: unit-rigidbody2d.tscn
visual: false
renders_as: a transform-only group
---

# RigidBody2D

A 2D body the physics engine moves. Neither Godot nor the previewer draws it:
both show its children, and the previewer mounts it as a transform-only Node2D
group (ADR-0008). In the capture that is a toggle-gated `CollisionShape2D`
overlay and a green `ColorRect`.

The simulation itself is out of scope — a `.tscn` is a starting state, and
nothing here steps it forward.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `position` | `Vector2(0, 0)` | the body's starting placement |
| `mass` | `1` | inertia the solver would give it |
| `gravity_scale` | `1` | multiplier on the area's gravity |
| `collision_layer` | `8` | the layers this body occupies |
| `collision_mask` | `16` | the layers it scans for contacts |

## Divergences

None at load time. A running Godot would move this node and the previewer would
not, but that difference belongs to the simulation rather than to the scene the
file describes.

## Linting

<!-- lint:begin RigidBody2D -->
Strict parsing format-checks these `RigidBody2D` properties, plus 5 inherited from CollisionObject2D, 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `angular_damp` | float >= -1 | error below |
| `angular_damp_mode` | enum 0-1 (COMBINE/REPLACE) | warning |
| `angular_velocity` | float |  |
| `can_sleep` | true or false |  |
| `center_of_mass` | Vector2(x, y) |  |
| `center_of_mass_mode` | enum 0-1 (AUTO/CUSTOM) | warning |
| `constant_force` | Vector2(x, y) |  |
| `constant_torque` | float |  |
| `contact_monitor` | true or false |  |
| `continuous_cd` | enum 0-2 (DISABLED/CAST_RAY/CAST_SHAPE) | warning |
| `custom_integrator` | true or false |  |
| `freeze` | true or false |  |
| `freeze_mode` | enum 0-1 (STATIC/KINEMATIC) | warning |
| `gravity_scale` | float |  |
| `inertia` | float >= 0 | error below |
| `linear_damp` | float >= -1 | error below |
| `linear_damp_mode` | enum 0-1 (COMBINE/REPLACE) | warning |
| `linear_velocity` | Vector2(x, y) |  |
| `lock_rotation` | true or false |  |
| `mass` | float >= 0.001 | error at or below 0, warning below 0.001 |
| `max_contacts_reported` | integer >= 0, < 4096 | error below 0, error at or above 4096 |
| `physics_material_override` | null, SubResource("id") or ExtResource("id") |  |
| `sleeping` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-rigidbody2d` (type-family match) | `valid-rigidbody2d-resources` | error |
|  | `rigidbody2d-needs-collision-shape` | warning |
|  | `rigidbody2d-max-contacts-without-monitor` | warning |
|  | `rigidbody2d-scale-overridden-at-runtime` | warning |
<!-- lint:end -->

A non-positive `mass` is reported, because Godot's own setter refuses it rather
than clamping. `gravity_scale` is unbounded in either direction and so carries no
range at all — a negative value is a legitimate way to make a body fall upward,
and inventing a floor for it would reject scenes the engine loads happily.
