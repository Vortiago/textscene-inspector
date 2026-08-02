---
type: GPUParticlesAttractorSphere3D
category: 3D
status: unimplemented
fixture: unit-gpu-particles-attractor-sphere-3d.tscn
# image: unit-gpu-particles-attractor-sphere-3d
renders_as: nothing yet, not implemented
---

# GPUParticlesAttractorSphere3D

A spheroid-shaped attractor that pulls or pushes particles emitted by nearby `GPUParticles3D`
nodes toward or away from its origin. Godot draws its effect on a particle cloud in
real time; the previewer parses and validates the node but does not yet draw the sphere or
apply its force, so it renders as an invisible transform-only fallback and its children
still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| radius | 2.5 | The attractor sphere's radius in 3D units, centered on its origin. |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin GPUParticlesAttractorSphere3D -->
Strict parsing format-checks these `GPUParticlesAttractorSphere3D` properties, plus 4 inherited from GPUParticlesAttractor3D, 1 inherited from VisualInstance3D, 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

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
maximum is enforced. All other members come from the GPUParticlesAttractor3D base
tier through the base-walk.
