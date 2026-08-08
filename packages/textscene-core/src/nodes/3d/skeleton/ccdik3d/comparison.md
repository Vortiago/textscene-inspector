---
type: CCDIK3D
category: 3D
status: linter-only
fixture: unit-ccdik-3d.tscn
# image: unit-ccdik-3d
visual: false
renders_as: nothing (a transform-only group)
---

# CCDIK3D

Cyclic coordinate descent inverse kinematics: it rotates a bone chain joint by
joint, from the chain's far end back toward the root, until the tip reaches the
target. It is a solver, so it draws nothing at runtime, and the previewer renders
it as a transform-only group (ADR-0008) whose children keep their transform space.

CCDIK3D binds no property of its own. Its entire body is one `_solve_iteration`
override, so it swaps the solve step and inherits its whole configuration surface:
the target and joint settings from IterateIK3D and ChainIK3D, the iteration
budget from IterateIK3D, and `mutable_bone_axes` from IKModifier3D.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `influence` | `0.75` | blends the solved pose 75% of the way over the input pose |
| `mutable_bone_axes` | `false` | bone axes come from the rest pose rather than the current pose |
| `max_iterations` | `20` | up to 20 solve passes per frame, against a default of 4 |
| `min_distance` | `0.005` | iteration stops once the tip is within `0.005` of the target |
| `angular_delta_limit` | `0.0872665` | caps a joint at 5 degrees per pass; the value is radians, the hint is degrees |
| `deterministic` | `true` | discards the previous frame's result, so the same target and input pose always solve the same |

Every one of these is inherited: the node itself declares nothing, so a fixture
that exercised only its own keys would set nothing at all. All six carry
non-default values, since a default is the value Godot omits when it saves.

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin CCDIK3D -->
Strict parsing format-checks the inherited set (6 inherited from IterateIK3D, 1 inherited from IKModifier3D, 2 inherited from SkeletonModifier3D, 16 inherited from Node3D, 10 inherited from Node); `CCDIK3D` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
| `valid-iterateik3d-target-node` (type-family match) | `iterateik3d-setting-missing-target-node` | warning |
<!-- lint:end -->

CCDIK3D registers no validator of its own, so nothing strict rejects here is
something lenient substitutes for: the two disagree only on inherited keys. The
lenient parser reuses `parseNode3D`, which reads exactly `transform` and
`visible` and drops every solver key on the floor, so `influence`,
`max_iterations`, `min_distance`, `angular_delta_limit`, `deterministic` and
`mutable_bone_axes` never reach the scene tree and have no fallback value to
report. Strict parsing still range-checks them through the base-walk, five
classes deep, which is where a bad `angular_delta_limit` gets caught.
