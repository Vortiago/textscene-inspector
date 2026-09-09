---
type: GPUParticlesCollisionSphere3D
category: 3D
status: unimplemented
fixture: unit-gpu-particles-collision-sphere-3d.tscn
# image: unit-gpu-particles-collision-sphere-3d
renders_as: nothing yet, not implemented
---

# GPUParticlesCollisionSphere3D

A sphere that particles from nearby `GPUParticles3D` nodes collide with. The previewer does not draw the sphere or apply the collision yet, so the node is an invisible transform-only fallback and its children still show.

## Linting

<!-- lint:begin GPUParticlesCollisionSphere3D -->
Strict parsing format-checks these `GPUParticlesCollisionSphere3D` properties, plus 1 inherited from GPUParticlesCollision3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `radius` | float >= 0.01 | warning below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads only `transform` and `visible`. A `radius` below `0.01` or a non-numeric one parses with no warning and no fallback, and only strict reports it.

## Known limitations

- **Needs runtime** Godot stops a live particle cloud at the sphere. Here there is no cloud to stop.
