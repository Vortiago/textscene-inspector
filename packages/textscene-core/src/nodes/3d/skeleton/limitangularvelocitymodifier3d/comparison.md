---
type: LimitAngularVelocityModifier3D
category: 3D
status: linter-only
fixture: unit-limit-angular-velocity-modifier-3d.tscn
# image: unit-limit-angular-velocity-modifier-3d
visual: false
renders_as: nothing (a transform-only group)
---

# LimitAngularVelocityModifier3D

Caps how fast a bone may rotate, slerping only as far as `max_angular_velocity * delta` allows each frame. It post-processes another modifier's pose and draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008).

## Linting

<!-- lint:begin LimitAngularVelocityModifier3D -->
Strict parsing format-checks these `LimitAngularVelocityModifier3D` properties, plus 2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `chain_count` | integer >= 0 | error below |
| `chains/#/*` | LimitAngularVelocityModifier3D chain |  |
| `exclude` | true or false |  |
| `joints/#/*` | read-only (derived from LimitAngularVelocityModifier3D's per-chain root_bone and end_bone) |  |
| `max_angular_velocity` | float >= -0.0001 | warning below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, so every key above is dropped before it reaches the scene tree and has no fallback. Strict errors on `chain_count = -1`, warns on a negative `max_angular_velocity` and refuses the derived `joints/<i>/` keys outright.
