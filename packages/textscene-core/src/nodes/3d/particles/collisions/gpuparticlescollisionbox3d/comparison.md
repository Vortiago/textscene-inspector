---
type: GPUParticlesCollisionBox3D
category: 3D
status: unimplemented
fixture: unit-gpu-particles-collision-box-3d.tscn
# image: unit-gpu-particles-collision-box-3d
renders_as: nothing yet, not implemented
---

# GPUParticlesCollisionBox3D

A box that particles from nearby `GPUParticles3D` nodes collide with. The previewer does not draw the box or apply the collision yet, so the node is an invisible transform-only fallback and its children still show.

## Linting

<!-- lint:begin GPUParticlesCollisionBox3D -->
Strict parsing format-checks these `GPUParticlesCollisionBox3D` properties, plus 1 inherited from GPUParticlesCollision3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `size` | Vector3(x, y, z), each float >= 0.01 | warning below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads only `transform` and `visible`. A `size` below `0.01` or a malformed `Vector3` parses with no warning and no fallback, and only strict reports it.

## Known limitations

- **Needs runtime** Godot stops a live particle cloud at the box. Here there is no cloud to stop.
