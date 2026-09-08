---
type: BoneConstraint3D
category: 3D
status: linter-only
fixture: unit-bone-constraint-3d.tscn
# image: unit-bone-constraint-3d
visual: false
renders_as: nothing (a transform-only group)
---

# BoneConstraint3D

The base class of the bone constraint modifiers, holding the `settings/<i>/` entries that name an apply bone and a reference bone or node. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin BoneConstraint3D -->
Strict parsing format-checks these `BoneConstraint3D` properties, plus 2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `settings/#/*` | BoneConstraint3D setting |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads only `transform` and `visible`, so every `settings/<i>/` leaf is dropped rather than substituted and only strict reports a bad one.
