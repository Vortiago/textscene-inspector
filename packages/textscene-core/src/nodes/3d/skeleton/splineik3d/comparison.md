---
type: SplineIK3D
category: 3D
status: linter-only
fixture: unit-spline-ik-3d.tscn
# image: unit-spline-ik-3d
visual: false
renders_as: nothing (a transform-only group)
---

# SplineIK3D

Aligns a chain of bones along a `Path3D`, laying each joint down the curve in
turn and twisting it to the curve's point tilt. It is a solver, so it draws
nothing at runtime, and the previewer renders it as a transform-only group
(ADR-0008) whose children keep their transform space.

Its own surface is small and split in two. `setting_count` is the array count,
declared by this class rather than by ChainIK3D, which binds no property at all.
The other four keys are leaves SplineIK3D adds by hand to the `settings/<i>/`
family ChainIK3D owns: the path to follow, and three keys governing how the
curve's tilt reaches the bones. Everything else, the root and end bones, the
joint list, `mutable_bone_axes`, `influence`, comes from the four ancestors.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `setting_count` | `2` | allocates two independent bone chains on one modifier |
| `settings/0/path_3d` | `NodePath("../../SplinePath")` | the `Path3D` whose `Curve3D` the first chain is laid along |
| `settings/0/tilt_fade_in` | `4` | interpolates tilt across the first 4 bones where the root sits away from the curve's start |
| `settings/0/tilt_fade_out` | `0` | unifies the tilt between the end bone's tail and the curve's end point, rather than fading it |
| `settings/1/path_3d` | `NodePath("../../SplinePath")` | the second chain follows the same path |
| `settings/1/tilt_enabled` | `false` | the curve's point tilt stops affecting bone twist, and Godot then stops serialising that setting's two fade keys |

The two fade sizes count BONES. Their hint reads `-1,100,1,or_greater`, with no
`radians_as_degrees` anywhere in this class, so unlike most of the skeleton
family nothing here is a degree value stored as radians.

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin SplineIK3D -->
Strict parsing format-checks these `SplineIK3D` properties, plus 1 inherited from ChainIK3D, 1 inherited from IKModifier3D, 2 inherited from SkeletonModifier3D, 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `setting_count` | integer >= 0 |
| `settings/#/*` | per-setting spline fitting, plus ChainIK3D's bone chain setup |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
| `valid-splineik3d-path-3d` (type-family match) | `splineik3d-setting-without-path-3d` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads exactly `transform` and
`visible`, so `setting_count` and every `settings/<i>/` key is dropped before
reaching the scene tree and has no fallback value to report: strict rejects
`setting_count = -1` outright, and lenient does not substitute a count, it keeps
none. The one strict-only diagnostic worth naming is an absence rather than a
value. A setting with no `path_3d` is what Godot writes for a freshly added
entry, and it lints as a warning because `_process_ik` resolves that NodePath
before it reads the curve and abandons the setting when nothing comes back, so
the chain is never posed while the node looks fully configured.
