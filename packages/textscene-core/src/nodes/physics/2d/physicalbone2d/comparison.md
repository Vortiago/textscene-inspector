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

PhysicalBone2D is a RigidBody2D-derived node that makes a Bone2D inside a Skeleton2D react to physics. Like every physics body it has no runtime visual of its own, so the previewer mounts it as a transform-only Node2D group (ADR-0008) and draws nothing for it.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `position` | `Vector2(10, 20)` | shifts the invisible node; no pixels |
| `bone2d_nodepath` | `NodePath("../Bone")` | names the Bone2D to simulate; not drawn |
| `bone2d_index` | `0` | the bone's index inside the Skeleton2D; not drawn |
| `auto_configure_joint` | `false` | skips auto-configuring a child Joint2D; not drawn |
| `simulate_physics` | `true` | drives physics simulation instead of following the bone; not drawn |
| `follow_bone_when_simulating` | `true` | keeps the bone's transform while simulating; not drawn |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin PhysicalBone2D -->
Strict parsing format-checks these `PhysicalBone2D` properties, plus 15 inherited from RigidBody2D, 5 inherited from CollisionObject2D, 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `auto_configure_joint` | true or false |
| `bone2d_index` | integer 0-1000 |
| `bone2d_nodepath` | NodePath("path/to/node") |
| `follow_bone_when_simulating` | true or false |
| `simulate_physics` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-rigidbody2d` (type-family match) | `valid-rigidbody2d-resources` | error |
|  | `rigidbody2d-needs-collision-shape` | warning |
|  | `rigidbody2d-mass-too-low` | warning |
|  | `rigidbody2d-max-contacts-without-monitor` | warning |
|  | `rigidbody2d-scale-overridden-at-runtime` | warning |
| `valid-physicalbone2d` | `physicalbone2d-missing-skeleton-parent` | warning |
|  | `physicalbone2d-missing-bone-index` | warning |
|  | `physicalbone2d-missing-joint-child` | warning |
<!-- lint:end -->

PhysicalBone2D has no `parser.ts`: it reuses `parseNode2D` directly (index.ts), so
none of the strict-validated properties (`bone2d_nodepath`, `bone2d_index`,
`auto_configure_joint`, `simulate_physics`, `follow_bone_when_simulating`) are read
by the lenient parser at all. The node renders as a transform-only group, so
there is no substitution to describe.
