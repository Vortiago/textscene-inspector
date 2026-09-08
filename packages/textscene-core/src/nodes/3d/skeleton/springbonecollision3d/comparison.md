---
type: SpringBoneCollision3D
category: 3D
status: linter-only
fixture: unit-spring-bone-collision-3d.tscn
# image: unit-spring-bone-collision-3d
visual: false
renders_as: a transform-only group
---

# SpringBoneCollision3D

A collider a SpringBoneSimulator3D consults while resolving its spring bones each frame. Its shape is an editor gizmo only, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin SpringBoneCollision3D -->
Strict parsing format-checks these `SpringBoneCollision3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `bone` | integer |  |
| `bone_name` | quoted string or &"name" |  |
| `position_offset` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `rotation_offset` | Quaternion(x, y, z, w) |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-springbonecollision3d-parent` (type-family match) | `springbonecollision3d-outside-springbonesimulator3d` | warning |
<!-- lint:end -->

SpringBoneCollision3D registers `parseNode3D` directly, so `bone_name`, `bone`, `position_offset` and `rotation_offset` are never read. An unquoted `bone_name = Head` or a non-numeric `bone = abc` is dropped silently, and only strict reports it.

## Known limitations

- **Editor only** The collider gizmo appears only in Godot's editor. Here it is absent.
