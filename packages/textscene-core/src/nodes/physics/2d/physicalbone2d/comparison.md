---
type: PhysicalBone2D
category: 2D
status: linter-only
fixture: unit-physical-bone-2d.tscn
# image: unit-physical-bone-2d
visual: false
renders_as: a transform-only Node2D group
---

# PhysicalBone2D

A RigidBody2D that makes a Bone2D inside a Skeleton2D react to physics. It has no runtime visual, so the previewer mounts it as a transform-only Node2D group (ADR-0008).

## Linting

<!-- lint:begin PhysicalBone2D -->
Strict parsing format-checks these `PhysicalBone2D` properties, plus 23 inherited from RigidBody2D, 5 inherited from CollisionObject2D, 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `auto_configure_joint` | true or false |  |
| `bone2d_index` | integer 0-1000 | error below, warning above |
| `bone2d_nodepath` | NodePath("path/to/node") |  |
| `follow_bone_when_simulating` | true or false |  |
| `simulate_physics` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-rigidbody2d` (type-family match) | `rigidbody2d-max-contacts-without-monitor` | info |
|  | `rigidbody2d-scale-overridden-at-runtime` | warning |
| `valid-collisionobject2d` (type-family match) | `collisionobject2d-needs-collision-shape` | warning |
| `valid-physicalbone2d` | `physicalbone2d-missing-skeleton-parent` | warning |
|  | `physicalbone2d-missing-bone-index` | warning |
|  | `physicalbone2d-missing-joint-child` | warning |
<!-- lint:end -->

PhysicalBone2D reuses `parseNode2D` directly, so `bone2d_nodepath`, `bone2d_index` and the three flags are never read by the lenient parser. There is no substitution to describe.
