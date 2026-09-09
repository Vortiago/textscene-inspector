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

A Jacobian-transpose IK solver that turns every joint in the chain at once toward the target, converging slowly but moving smoothly. It drives a parent Skeleton3D's poses and draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008).

## Linting

<!-- lint:begin JacobianIK3D -->
Strict parsing format-checks the inherited set (6 inherited from IterateIK3D, 1 inherited from IKModifier3D, 2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node); `JacobianIK3D` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
| `valid-iterateik3d-target-node` (type-family match) | `iterateik3d-setting-missing-target-node` | warning |
<!-- lint:end -->

JacobianIK3D declares no validator of its own, and the slice registers `parseNode3D` directly, so only the Node3D keys are read. An `angular_delta_limit` above PI is a warning strict reports through the inherited set and lenient drops.
