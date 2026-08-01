---
type: GPUParticlesCollisionSphere3D
category: 3D
status: unimplemented
fixture: unit-gpu-particles-collision-sphere-3d.tscn
# image: unit-gpu-particles-collision-sphere-3d
renders_as: nothing yet, not implemented
---

# GPUParticlesCollisionSphere3D

A sphere-shaped collision shape that particles emitted by nearby `GPUParticles3D` nodes
collide with. Godot draws its effect on a particle cloud in real time; the previewer
parses and validates the node but does not yet draw the sphere or apply the collision,
so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| radius | 1.5 | The collision sphere's radius in 3D units. |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin GPUParticlesCollisionSphere3D -->
Strict parsing format-checks these `GPUParticlesCollisionSphere3D` properties, plus 1 inherited from GPUParticlesCollision3D, 1 inherited from VisualInstance3D, 16 inherited from Node3D. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `radius` | float >= 0.01 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
<!-- lint:end -->

`radius` is validated as a float that must be at least 0.01, the hard floor Godot's
PROPERTY_HINT_RANGE hint sets. The stated 1024 upper bound is soft (or_greater), so no
maximum is enforced. `cull_mask` and the rest come from the GPUParticlesCollision3D base
tier through the base-walk.
