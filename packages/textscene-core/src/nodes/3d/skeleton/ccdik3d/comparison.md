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

Cyclic coordinate descent inverse kinematics: it rotates a bone chain joint by joint, from the far end back to the root, until the tip reaches the target. It is a solver and draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008).

## Linting

<!-- lint:begin CCDIK3D -->
Strict parsing format-checks the inherited set (6 inherited from IterateIK3D, 1 inherited from IKModifier3D, 2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node); `CCDIK3D` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
| `valid-iterateik3d-target-node` (type-family match) | `iterateik3d-setting-missing-target-node` | warning |
<!-- lint:end -->

CCDIK3D registers no validator of its own, and the lenient parser reuses `parseNode3D`. `influence`, `max_iterations`, `min_distance`, `angular_delta_limit`, `deterministic` and `mutable_bone_axes` are dropped with no fallback, and strict range-checks them through the base-walk.
