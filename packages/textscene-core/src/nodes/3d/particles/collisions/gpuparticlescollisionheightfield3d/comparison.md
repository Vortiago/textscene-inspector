---
type: GPUParticlesCollisionHeightField3D
category: 3D
status: unimplemented
fixture: unit-gpu-particles-collision-height-field-3d.tscn
# image: unit-gpu-particles-collision-height-field-3d
renders_as: nothing yet, not implemented
---

# GPUParticlesCollisionHeightField3D

A heightmap, regenerated in real time from the scene's geometry, that particles from nearby `GPUParticles3D` nodes collide with. The previewer draws its editor gizmo. It does not generate the heightmap, so the node draws no volume and its children still show.

## Gizmo

The previewer draws the gizmo of Godot's editor in the collision colour. It draws the 12 edges of the box of `size`, centred on the node. `resolution` does not change the gizmo. Godot draws it for every node, faint while the node is not selected (ADR-0056). The previewer draws no edit handles.

## Linting

<!-- lint:begin GPUParticlesCollisionHeightField3D -->
Strict parsing format-checks these `GPUParticlesCollisionHeightField3D` properties, plus 1 inherited from GPUParticlesCollision3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `follow_camera_enabled` | true or false |  |
| `heightfield_mask` | 32-bit layer mask (layers 1-32) |  |
| `resolution` | enum 0-5 (256/512/1024/2048/4096/8192) | warning |
| `size` | Vector3(x, y, z), each float >= 0.01 | warning below |
| `update_mode` | enum 0-1 (WHEN_MOVED/ALWAYS) | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

The lenient parser reads `size` for the gizmo. A malformed `Vector3` keeps Godot's default. A `size` below `0.01` stays as Godot's setter keeps it, and only strict reports it. `resolution` does not change the gizmo, so the lenient parser ignores it.

## Known limitations

- **Needs runtime** Godot stops a live particle cloud at the heightmap, but here there is no cloud to stop.