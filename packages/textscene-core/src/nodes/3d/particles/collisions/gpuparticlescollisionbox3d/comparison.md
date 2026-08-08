---
type: GPUParticlesCollisionBox3D
category: 3D
status: unimplemented
fixture: unit-gpu-particles-collision-box-3d.tscn
# image: unit-gpu-particles-collision-box-3d
renders_as: nothing yet, not implemented
---

# GPUParticlesCollisionBox3D

A box-shaped collision shape that particles emitted by nearby `GPUParticles3D` nodes
collide with. Godot draws its effect on a particle cloud in real time; the previewer
parses and validates the node but does not yet draw the box or apply the collision,
so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| size | Vector3(3, 1.5, 3) | The collision box's size in 3D units. |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin GPUParticlesCollisionBox3D -->
Strict parsing format-checks these `GPUParticlesCollisionBox3D` properties, plus 1 inherited from GPUParticlesCollision3D, 1 inherited from VisualInstance3D, 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `size` | Vector3(x, y, z), each float >= 0.01 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

`size` is validated as a Vector3 whose components must each be at least 0.01, the
hard floor Godot's PROPERTY_HINT_RANGE hint sets. The stated 1024 upper bound is soft
(or_greater), so no maximum is enforced. `cull_mask` and the rest come from the
GPUParticlesCollision3D base tier through the base-walk.
