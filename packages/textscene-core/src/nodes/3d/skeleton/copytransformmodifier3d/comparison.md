---
type: CopyTransformModifier3D
category: 3D
status: linter-only
fixture: unit-copy-transform-modifier-3d.tscn
# image: unit-copy-transform-modifier-3d
visual: false
renders_as: a transform-only group
---

# CopyTransformModifier3D

Copies a reference bone's or node's transform onto an apply bone each frame, masked per component and per axis by its `settings/<i>/` entries. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin CopyTransformModifier3D -->
Strict parsing format-checks these `CopyTransformModifier3D` properties, plus 2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `setting_count` | integer >= 0 | error below |
| `settings/#/*` | per-setting copy, axes and invert bit masks, plus relative and additive |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
<!-- lint:end -->

CopyTransformModifier3D registers `parseNode3D` directly, so `setting_count` and every `settings/<i>/` leaf is validated but never read into the scene tree. A `copy`, `axes` or `invert` bit outside the three-bit flag list is a warning strict reports and lenient drops.
