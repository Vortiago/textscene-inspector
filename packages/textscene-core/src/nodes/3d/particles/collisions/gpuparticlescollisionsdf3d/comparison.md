---
type: GPUParticlesCollisionSDF3D
category: 3D
status: unimplemented
fixture: unit-gpu-particles-collision-sdf-3d.tscn
# image: unit-gpu-particles-collision-sdf-3d
renders_as: nothing yet, not implemented
---

# GPUParticlesCollisionSDF3D

A baked signed distance field that particles from nearby `GPUParticles3D` nodes collide with. The previewer draws its editor gizmo. It does not apply the collision yet, so the node draws no volume and its children still show.

## Gizmo

The previewer draws the gizmo of Godot's editor in the collision colour. It draws the 12 edges of the box of `size`, centred on the node, and the grid of its cells at a low opacity. `resolution` sets how many cells divide the longest side. Godot draws it for every node, faint while the node is not selected (ADR-0056). The previewer draws no edit handles.

## Linting

<!-- lint:begin GPUParticlesCollisionSDF3D -->
Strict parsing format-checks these `GPUParticlesCollisionSDF3D` properties, plus 1 inherited from GPUParticlesCollision3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `bake_mask` | 32-bit layer mask (layers 1-32) |  |
| `resolution` | enum 0-5 (16/32/64/128/256/512) | warning |
| `size` | Vector3(x, y, z), each float >= 0.01 | warning below |
| `texture` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `thickness` | float 0-2 | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-gpuparticlescollisionsdf3d-bake-mask` (type-family match) | `gpuparticlescollisionsdf3d-empty-bake-mask` | warning |
<!-- lint:end -->

The lenient parser reads `size` and `resolution` for the gizmo. A malformed `Vector3` or an out-of-range `resolution` keeps Godot's default, and only strict reports it.

## Known limitations

- **Needs runtime** Godot stops a live particle cloud at the baked field, but here there is no cloud to stop.
