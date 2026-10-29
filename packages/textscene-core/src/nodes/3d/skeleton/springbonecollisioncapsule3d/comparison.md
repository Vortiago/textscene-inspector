---
type: SpringBoneCollisionCapsule3D
category: 3D
status: unimplemented
fixture: unit-spring-bone-collision-capsule-3d.tscn
# image: unit-spring-bone-collision-capsule-3d
visual: false
renders_as: nothing yet, Godot's spring solver collides bones with it, the previewer does not
---

# SpringBoneCollisionCapsule3D

The capsule-shaped collider a SpringBoneSimulator3D consults while resolving its spring bones. The previewer runs no spring solver (ADR-0045), so the capsule guards nothing, and the node mounts as its base with its children still showing.

## Linting

<!-- lint:begin SpringBoneCollisionCapsule3D -->
Strict parsing format-checks these `SpringBoneCollisionCapsule3D` properties, plus 4 inherited from SpringBoneCollision3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `height` | float >= 0 | warning below |
| `inside` | true or false |  |
| `radius` | float >= 0 | warning below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-springbonecollision3d-parent` (type-family match) | `springbonecollision3d-outside-springbonesimulator3d` | warning |
| `valid-springbonecollisioncapsule3d-shape` | `springbonecollisioncapsule3d-radius-exceeds-half-height` | error |
<!-- lint:end -->

SpringBoneCollisionCapsule3D registers `parseNode3D` directly, so `radius`, `height` and `inside` are never read and a malformed one is dropped silently. Strict warns when `radius` exceeds half of `height`. Godot's setters then rewrite the other property to restore that invariant, so the loaded capsule differs from the one on disk.

## Known limitations

- **Needs runtime** Godot's SpringBoneSimulator3D resolves its bones against this capsule each frame, but here the bones hold their rest pose.
- **Editor only** The capsule gizmo appears only in Godot's editor, but here it is absent.
