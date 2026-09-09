---
type: TwoBoneIK3D
category: 3D
status: linter-only
fixture: unit-two-bone-ik-3d.tscn
# image: unit-two-bone-ik-3d
visual: false
renders_as: nothing (a transform-only group)
---

# TwoBoneIK3D

A rotation-based two-bone IK solver. It builds a plane from the root, middle and end joints plus a pole target, then poses the skeleton so the end bone reaches the target. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin TwoBoneIK3D -->
Strict parsing format-checks these `TwoBoneIK3D` properties, plus 1 inherited from IKModifier3D, 2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `setting_count` | integer >= 0 | error below |
| `settings/*` | per-setting bone chain, pole direction and virtual end-bone setup |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
| `valid-twoboneik3d-settings` (type-family match) | `twoboneik3d-setting-index-out-of-range` | error |
|  | `twoboneik3d-pole-direction-vector-ignored` | error |
|  | `twoboneik3d-setting-missing-target-node` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, so `setting_count` and every `settings/<i>/` value is dropped rather than substituted, with no fallback to name. Strict warns on a `pole_direction` outside `0-7` or an `end_bone/direction` outside `0-6`, since Godot's setters assign whatever integer they are handed.
