---
type: FABRIK3D
category: 3D
status: linter-only
fixture: unit-fabrik-3d.tscn
# image: unit-fabrik-3d
visual: false
renders_as: nothing (a transform-only group)
---

# FABRIK3D

The position-based IK solver: each frame it drags a bone chain onto its target with a backward reaching pass and a forward one, writing the result into the parent Skeleton3D's poses. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin FABRIK3D -->
Strict parsing format-checks the inherited set (6 inherited from IterateIK3D, 1 inherited from IKModifier3D, 2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node); `FABRIK3D` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
| `valid-iterateik3d-target-node` (type-family match) | `iterateik3d-setting-missing-target-node` | warning |
<!-- lint:end -->

FABRIK3D declares no validator of its own, and `index.ts` registers `parseNode3D` directly, so the solver keys are never read by the lenient parser. A value strict rejects through the inherited set is dropped rather than substituted.
