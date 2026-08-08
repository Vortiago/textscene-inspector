---
type: JacobianIK3D
category: 3D
status: linter-only
fixture: unit-jacobian-ik-3d.tscn
# image: unit-jacobian-ik-3d
visual: false
renders_as: nothing (a transform-only group)
---

# JacobianIK3D

JacobianIK3D is a Jacobian-transpose IK solver: it turns every joint in the chain at
once toward the target, which converges slowly but moves smoothly, and it keeps the
previous pose's twist around the forward vector. It drives a parent Skeleton3D's bone
poses and draws nothing at runtime, so the previewer renders it as a transform-only
group (ADR-0008) and its children still land in the right transform space.

## Properties exercised

Every one is inherited, because JacobianIK3D declares nothing of its own. Nothing here
has a visible consequence: the node draws nothing, so the column records what the value
means to the solver.

| Property | Value | Effect |
| --- | --- | --- |
| `active` | `true` | the modifier runs (SkeletonModifier3D) |
| `influence` | `0.75` | blends 75% of the solved pose into the skeleton |
| `mutable_bone_axes` | `true` | the solver may rewrite bone axes (IKModifier3D) |
| `max_iterations` | `10` | at most 10 solver passes per frame (IterateIK3D) |
| `min_distance` | `0.01` | stops once the effector is within 0.01 m of the target |
| `angular_delta_limit` | `0.0872665` | clips each pass to 5 degrees, stored in RADIANS |
| `deterministic` | `true` | solves from the rest pose, so the result is frame-independent |
| `setting_count` | `1` | one IK chain configured |
| `settings/0/root_bone_name` | `"Root"` | the chain's first bone (ChainIK3D's half of the family) |
| `settings/0/end_bone_name` | `"Tip"` | the chain's last bone |
| `settings/0/end_bone/length` | `0.1` | 0.1 m of extension past the end bone |
| `settings/0/target_node` | `NodePath("../../Target")` | what the effector reaches for (IterateIK3D's half) |

`angular_delta_limit` is the one to read twice. Its hint is `"0,180,0.001,
radians_as_degrees"`, so the inspector shows degrees while the `.tscn` stores radians:
the ceiling is PI, not 180, and `0.0872665` is 5 degrees rather than a value near zero.

The `settings/<i>/` keys are one serialised family with two owners, so they exercise
both. IterateIK3D declares `target_node` and the `joints/<j>/` block and hands every
other leaf back to ChainIK3D, which declares the bone-chain setup.

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin JacobianIK3D -->
Strict parsing format-checks the inherited set (6 inherited from IterateIK3D, 1 inherited from IKModifier3D, 2 inherited from SkeletonModifier3D, 16 inherited from Node3D, 10 inherited from Node); `JacobianIK3D` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
| `valid-iterateik3d-target-node` (type-family match) | `iterateik3d-setting-missing-target-node` | warning |
<!-- lint:end -->

JacobianIK3D declares no validators and no semantic rules, and never will: the class
binds no property of its own, so there is no key for the two parsers to disagree
about. Every value a scene writes on one is checked by an inherited validator from
IterateIK3D or above, reached through the base-walk. On the lenient side there is no
substitution to report either, since the slice registers `parseNode3D` directly rather
than a `parser.ts`: only the Node3D keys are read at all, and an unrecognised
property is dropped rather than replaced with a fallback.
