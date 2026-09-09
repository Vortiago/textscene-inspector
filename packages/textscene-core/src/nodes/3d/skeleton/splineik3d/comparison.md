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

Aligns a chain of bones along a `Path3D`, laying each joint down the curve and twisting it to the curve's point tilt. It is a solver and draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008).

## Linting

<!-- lint:begin SplineIK3D -->
Strict parsing format-checks these `SplineIK3D` properties, plus 1 inherited from ChainIK3D, 1 inherited from IKModifier3D, 2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `setting_count` | integer >= 0 | error below |
| `settings/#/*` | per-setting spline fitting, plus ChainIK3D's bone chain setup |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
| `valid-splineik3d-path-3d` (type-family match) | `splineik3d-setting-without-path-3d` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, so `setting_count` and every `settings/<i>/` key is dropped with no fallback. Strict rejects `setting_count = -1` and warns on a setting with no `path_3d`, which Godot abandons at solve time while the node looks configured.
