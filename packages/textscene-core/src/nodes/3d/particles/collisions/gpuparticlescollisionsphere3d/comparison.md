---
type: GPUParticlesCollisionSphere3D
category: 3D
status: unimplemented
fixture: unit-gpu-particles-collision-sphere-3d.tscn
# image: unit-gpu-particles-collision-sphere-3d
renders_as: nothing yet, not implemented
---

# GPUParticlesCollisionSphere3D

A sphere that particles from nearby `GPUParticles3D` nodes collide with. The previewer draws its editor gizmo. It does not apply the collision yet, so the node draws no volume and its children still show.

## Gizmo

The previewer draws the gizmo of Godot's editor in the collision colour. It draws three great circles of `radius`, in the XZ, XY and YZ planes. Godot draws it for every node, faint while the node is not selected (ADR-0056). The previewer draws no edit handles.

## Linting

<!-- lint:begin GPUParticlesCollisionSphere3D -->

Strict parsing format-checks these `GPUParticlesCollisionSphere3D` properties, plus 1 inherited from GPUParticlesCollision3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts       | Out of range  |
| -------- | ------------- | ------------- |
| `radius` | float >= 0.01 | warning below |

| Rule                                          | Reports                     | Severity |
| --------------------------------------------- | --------------------------- | -------- |
| `binary-resource-reference` (all nodes)       | `binary-resource-reference` | info     |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility`   | error    |

<!-- lint:end -->

The lenient parser reads `radius` for the gizmo. A non-numeric `radius` keeps Godot's default. A `radius` below `0.01` stays as Godot's setter keeps it, and only strict reports it.

## Known limitations

- **Needs runtime** Godot stops a live particle cloud at the sphere, but here there is no cloud to stop.
