---
type: AnimatableBody3D
category: 3D
status: linter-only
fixture: unit-animatable-body-3d.tscn
# image: unit-animatable-body-3d
visual: false
renders_as: nothing (a transform-only group)
---

# AnimatableBody3D

A `StaticBody3D` meant to be moved by code, `AnimationMixer` or `RemoteTransform3D` rather than by physics. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008).

## Linting

<!-- lint:begin AnimatableBody3D -->
Strict parsing format-checks these `AnimatableBody3D` properties, plus 3 inherited from StaticBody3D, 6 inherited from PhysicsBody3D, 6 inherited from CollisionObject3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `sync_to_physics` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-collisionobject3d-scale` (type-family match) | `collisionobject3d-non-uniform-scale` | warning |
| `valid-collisionobject3d` (type-family match) | `collisionobject3d-needs-collision-shape` | warning |
<!-- lint:end -->

AnimatableBody3D registers `parseNode3D` directly, which reads only `transform` and `visible`. A non-boolean `sync_to_physics = "maybe"` is dropped rather than substituted or warned on, and survives only on `rawProperties`.
