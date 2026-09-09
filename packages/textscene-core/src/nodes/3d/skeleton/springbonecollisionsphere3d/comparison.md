---
type: SpringBoneCollisionSphere3D
category: 3D
status: linter-only
fixture: unit-spring-bone-collision-sphere-3d.tscn
# image: unit-spring-bone-collision-sphere-3d
visual: false
renders_as: a transform-only group
---

# SpringBoneCollisionSphere3D

The sphere collider a SpringBoneSimulator3D consults while resolving its spring bones. The sphere is an editor gizmo only, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin SpringBoneCollisionSphere3D -->
Strict parsing format-checks these `SpringBoneCollisionSphere3D` properties, plus 4 inherited from SpringBoneCollision3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `inside` | true or false |  |
| `radius` | float >= 0 | warning below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-springbonecollision3d-parent` (type-family match) | `springbonecollision3d-outside-springbonesimulator3d` | warning |
<!-- lint:end -->

SpringBoneCollisionSphere3D registers `parseNode3D` directly, so neither `radius` nor `inside` is ever read. A `radius = wide` or `inside = 1` is dropped silently rather than substituted, and only strict reports it.

## Known limitations

- **Editor only** The sphere gizmo appears only in Godot's editor. Here it is absent.
