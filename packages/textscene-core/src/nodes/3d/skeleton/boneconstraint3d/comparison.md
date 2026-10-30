---
type: BoneConstraint3D
category: 3D
status: done
fixture: unit-bone-constraint-3d.tscn
# image: unit-bone-constraint-3d
visual: false
renders_as: nothing (the base class makes no edit to the pose)
---

# BoneConstraint3D

The base class of the bone constraint modifiers, holding the `settings/<i>/` entries that name an apply bone and a reference bone or node. The base class makes no edit to the pose, as `_process_modification` is empty in Godot. A derived type reads the entries and applies them.

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

The parser reads `active`, `influence`, `setting_count` and the base `settings/<i>/` leaves: `amount`, the apply bone, and the reference bone or node. A bone name wins over a bone index, as `_validate_bone_names` reads them.
