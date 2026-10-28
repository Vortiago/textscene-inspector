---
type: CopyTransformModifier3D
category: 3D
status: limitation
fixture: unit-copy-transform-modifier-3d-ribbon.tscn
image: unit-copy-transform-modifier-3d-ribbon
renders_as: nothing (a transform-only modifier that edits the pose of the Skeleton3D above it)
---

# CopyTransformModifier3D

Copies a reference bone's or node's transform onto an apply bone, masked per component and per axis by its `settings/<i>/` entries. The Skeleton3D pass runs the copy on the file pose, in child order, and the result feeds the skin only. `active`, `influence`, `amount`, `relative`, `additive`, `invert` and a reference node act as `_process_copy` reads them. The fixture's ribbon bends a second time where b4 takes the turn of b2.

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

The parser reads `active`, `influence`, `setting_count` and every `settings/<i>/` leaf. A `copy`, `axes` or `invert` bit outside the three-bit flag list is a warning strict reports and lenient keeps, as Godot keeps the integer.

## Known limitations

- **Not drawn** A CopyTransformModifier3D under a Skeleton3D inside an instanced GLB changes nothing, where Godot runs it.
- **Not drawn** A reference node that is a BoneAttachment3D, or sits below one, reads the authored transform, where Godot reads the transform of the bone.
