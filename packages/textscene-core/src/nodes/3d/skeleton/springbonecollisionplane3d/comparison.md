---
type: SpringBoneCollisionPlane3D
category: 3D
status: linter-only
fixture: unit-spring-bone-collision-plane-3d.tscn
# image: unit-spring-bone-collision-plane-3d
visual: false
renders_as: a transform-only group
---

# SpringBoneCollisionPlane3D

An infinite plane that pushes a SpringBoneSimulator3D's bones back along its normal, +Y after the node's rotation. It draws nothing at runtime and its shape exists only as an editor gizmo, so the previewer renders it as a transform-only group (ADR-0008).

## Linting

<!-- lint:begin SpringBoneCollisionPlane3D -->
Strict parsing format-checks the inherited set (4 inherited from SpringBoneCollision3D, 17 inherited from Node3D, 10 inherited from Node); `SpringBoneCollisionPlane3D` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-springbonecollision3d-parent` (type-family match) | `springbonecollision3d-outside-springbonesimulator3d` | warning |
<!-- lint:end -->

SpringBoneCollisionPlane3D binds no property of its own and registers `parseNode3D` directly, so the inherited `bone_name`, `bone`, `position_offset` and `rotation_offset` are never read by the lenient side. A malformed one is dropped silently, while strict reports it through SpringBoneCollision3D's validators.

## Known limitations

- **Editor only** The plane gizmo appears only in Godot's editor. Here it is absent.
