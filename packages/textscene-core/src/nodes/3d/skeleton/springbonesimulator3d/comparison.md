---
type: SpringBoneSimulator3D
category: 3D
status: linter-only
fixture: unit-spring-bone-simulator-3d.tscn
# image: unit-spring-bone-simulator-3d
visual: false
renders_as: nothing (a transform-only group)
---

# SpringBoneSimulator3D

A SkeletonModifier3D that gives bone chains inertial wobble for hair, cloth and tails. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin SpringBoneSimulator3D -->
Strict parsing format-checks these `SpringBoneSimulator3D` properties, plus 2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `external_force` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `mutable_bone_axes` | true or false |  |
| `setting_count` | integer >= 0 | error below |
| `settings/*` | SpringBoneSimulator3D settings/<i>/ bone chain setup |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
| `valid-springbonesimulator3d-settings` (type-family match) | `springbonesimulator3d-setting-index-out-of-range` | error |
|  | `springbonesimulator3d-shared-config-ignored` | error |
|  | `springbonesimulator3d-joint-config-ignored` | error |
|  | `springbonesimulator3d-collision-list-ignored` | error |
<!-- lint:end -->

The lenient parser reuses `parseNode3D` and keeps only the transform, so every `settings/<i>/` key stays as a raw string in the property bag. Where strict rejects `settings/0/gravity/direction = Vector3(0, 0, 0)` or an index past `setting_count`, the lenient side falls back to nothing and draws the same empty group.
