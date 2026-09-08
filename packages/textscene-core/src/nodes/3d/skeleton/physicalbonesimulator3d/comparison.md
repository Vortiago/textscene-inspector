---
type: PhysicalBoneSimulator3D
category: 3D
status: linter-only
fixture: unit-physical-bone-simulator-3d.tscn
# image: unit-physical-bone-simulator-3d
visual: false
renders_as: nothing (a transform-only group)
---

# PhysicalBoneSimulator3D

The ragdoll driver: it hands the `PhysicalBone3D` nodes beneath it to the physics server and writes their poses back onto a parent Skeleton3D each frame. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin PhysicalBoneSimulator3D -->
Strict parsing format-checks the inherited set (2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node); `PhysicalBoneSimulator3D` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
<!-- lint:end -->

PhysicalBoneSimulator3D declares no validator of its own, and `index.ts` registers `parseNode3D` directly. A value strict rejects through the inherited set, such as an `influence` above 1, is dropped rather than substituted.
