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

A SkeletonModifier3D that gives bone chains inertial wobble for hair, cloth and
tails. It draws nothing at runtime, so the previewer renders it as a
transform-only group (ADR-0008): its children still show, and that absence is
the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `external_force` | `Vector3(0, 0, 0.1)` | constant wind pushing every chain along +Z |
| `mutable_bone_axes` | `false` | bone axes are cached from the rest pose instead of read each frame |
| `setting_count` | `2` | two bone chains, one per config mode |
| `settings/0/root_bone_name` | `"Bone0"` | first chain starts at Bone0 |
| `settings/0/end_bone_name` | `"Bone3"` | and ends at Bone3 |
| `settings/0/extend_end_bone` | `true` | the end bone gets a tail, so `end_bone/*` stays live |
| `settings/0/end_bone/direction` | `6` | `FromParent`, the tail follows the parent bone's axis |
| `settings/0/end_bone/length` | `0.05` | tail length in metres |
| `settings/0/center_from` | `2` | `Bone`, so movement is measured against a bone origin |
| `settings/0/center_bone_name` | `"Bone0"` | that bone |
| `settings/0/individual_config` | `false` | shared mode: one config drives the whole chain |
| `settings/0/rotation_axis` | `4` | `Custom`, which is what keeps `rotation_axis_vector` serialised |
| `settings/0/rotation_axis_vector` | `Vector3(1, 0, 0)` | the chain hinges about X |
| `settings/0/radius/value` | `0.02` | collision radius of every joint |
| `settings/0/radius/damping_curve` | `null` | no curve, the form Godot writes for an unset Curve |
| `settings/0/stiffness/value` | `1.0` | how fast the chain returns to its pose |
| `settings/0/drag/value` | `0.4` | how much the wobble is suppressed |
| `settings/0/gravity/value` | `0.0` | no constant fall |
| `settings/0/gravity/direction` | `Vector3(0, -1, 0)` | the direction it would fall in |
| `settings/0/joints/<j>/bone` | `0`, `1` | the derived joint list Godot writes in shared mode |
| `settings/0/enable_all_child_collisions` | `false` | the explicit collision list is the live one |
| `settings/0/collision_count` | `1` | one entry in it |
| `settings/0/collisions/0` | `NodePath("Sphere")` | pointing at the child collision |
| `settings/1/individual_config` | `true` | individual mode: each joint carries its own config |
| `settings/1/joint_count` | `2` | two joints in that chain |
| `settings/1/joints/0/rotation_axis` | `4` | `Custom` on the first joint |
| `settings/1/joints/<j>/radius` | `0.1` | per-joint collision radius |
| `settings/1/joints/<j>/stiffness` | `1.0` | per-joint return force |
| `settings/1/joints/<j>/gravity_direction` | `Vector3(0, -1, 0)` | per-joint fall direction |
| `settings/1/center_from` | `1` | `Node`, so `center_node` is the live centre key |
| `settings/1/exclude_collision_count` | `1` | with `enable_all_child_collisions` left at its default `true` |
| `settings/1/exclude_collisions/0` | `NodePath("Sphere")` | the child excluded from that chain |

## Divergences

None visible in this fixture: the node draws nothing in either engine.

## Linting

<!-- lint:begin SpringBoneSimulator3D -->
Strict parsing format-checks these `SpringBoneSimulator3D` properties, plus 2 inherited from SkeletonModifier3D, 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `external_force` | Vector3(x, y, z) |
| `mutable_bone_axes` | true or false |
| `setting_count` | integer >= 0 |
| `settings/*` | SpringBoneSimulator3D settings/<i>/ bone chain setup |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-springbonesimulator3d-settings` (type-family match) | `springbonesimulator3d-setting-index-out-of-range` | warning |
|  | `springbonesimulator3d-shared-config-ignored` | warning |
|  | `springbonesimulator3d-joint-config-ignored` | warning |
|  | `springbonesimulator3d-collision-list-ignored` | warning |
<!-- lint:end -->

The lenient parser never substitutes a value here, because SpringBoneSimulator3D
reuses `parseNode3D` and keeps only the transform; every `settings/<i>/…` key it
reads is carried through untouched and simply never consulted, since nothing is
simulated. So where strict rejects `settings/0/gravity/direction =
Vector3(0, 0, 0)` or a `settings/<i>/…` index past `setting_count`, the lenient
side does not fall back to a default: it keeps the raw string in the node's
property bag and draws the same empty group either way.

Two claims here rest on measured engine output rather than on reading the setter
alone. Godot writes `settings/<i>/joints/<j>/bone` and `bone_name` in the DEFAULT
shared mode and then refuses them on load, so both are accepted rather than
reported; and it writes a bare `null` for every unset damping curve, so those
four leaves accept `null` beside a resource reference.
