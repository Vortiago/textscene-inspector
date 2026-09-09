---
type: GPUParticlesAttractorBox3D
category: 3D
status: unimplemented
fixture: unit-gpu-particles-attractor-box-3d.tscn
# image: unit-gpu-particles-attractor-box-3d
renders_as: nothing yet, not implemented
---

# GPUParticlesAttractorBox3D

A box-shaped attractor that pulls or pushes particles from nearby `GPUParticles3D` nodes toward or away from its origin. The previewer does not draw the box or apply its force yet, so the node is an invisible transform-only fallback and its children still show.

## Linting

<!-- lint:begin GPUParticlesAttractorBox3D -->
Strict parsing format-checks these `GPUParticlesAttractorBox3D` properties, plus 4 inherited from GPUParticlesAttractor3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

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

- **Needs runtime** Godot bends a live particle cloud around the box. Here there is no cloud to bend.
