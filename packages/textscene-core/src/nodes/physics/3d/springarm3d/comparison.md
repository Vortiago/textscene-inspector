---
type: SpringArm3D
category: 3D
status: linter-only
fixture: unit-spring-arm-3d.tscn
# image: unit-spring-arm-3d
visual: false
renders_as: a transform-only group
---

# SpringArm3D

SpringArm3D casts a ray or a Shape3D along its local Z axis each physics frame and moves its direct children to the collision point minus a margin; it draws nothing itself at runtime, so the previewer renders it as a transform-only group (ADR-0008) — the only thing it ever affects is where its children sit.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `collision_mask` | `3` | physics layers 1 and 2 the cast checks against — no visible mark |
| `shape` | `SubResource("SphereShape3D_1")` | casts this Shape3D instead of a plain ray — no visible mark |
| `spring_length` | `4.0` | maximum extent of the ray/shape cast — no visible mark |
| `margin` | `0.05` | gap kept between a child and the collision point — no visible mark |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin SpringArm3D -->
Strict parsing format-checks these `SpringArm3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `collision_mask` | 32-bit layer mask (layers 1-32) | warning |
| `margin` | float |  |
| `shape` | null, SubResource("id") or ExtResource("id") |  |
| `spring_length` | float |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

SpringArm3D has no `parser.ts` of its own: it registers `parseNode3D` directly
(index.ts), so `collision_mask`, `shape`, `spring_length`, and `margin` are never
read at all, valid or not — an out-of-range `collision_mask = 4294967296` or a
non-numeric `spring_length = far` is silently dropped rather than substituted or
warned on, consistent with the node rendering as a transform-only group (ADR-0008).
