---
type: BoneAttachment3D
category: 3D
status: unimplemented
fixture: unit-bone-attachment-3d.tscn
# image: unit-bone-attachment-3d
visual: false
renders_as: nothing yet, Godot rides it on its bone each frame, the previewer parks it at its authored transform
---

# BoneAttachment3D

Copies one bone's global pose onto itself so its children ride that bone, or with `override_pose` on pushes its own transform back onto the bone. Godot updates that relay every frame, and the previewer does not yet (ADR-0045): the node sits at the transform the scene file states.

## Linting

<!-- lint:begin BoneAttachment3D -->
Strict parsing format-checks these `BoneAttachment3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `bone_idx` | integer >= -1 | error below |
| `bone_name` | quoted string or &"name" |  |
| `external_skeleton` | NodePath("path/to/node") |  |
| `override_pose` | true or false |  |
| `use_external_skeleton` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-boneattachment3d-skeleton` (type-family match) | `boneattachment3d-parent-not-skeleton3d` | warning |
|  | `boneattachment3d-external-skeleton-unset` | warning |
<!-- lint:end -->

The lenient parser reads BoneAttachment3D through `parseNode3D`, so `bone_name`, `bone_idx`, `override_pose`, `use_external_skeleton` and `external_skeleton` reach no fallback at all. Only strict reads them, and a bad value there is an error rather than a substitution.

## Known limitations

- **Approximated** The attachment and its children sit at the authored `transform`, where Godot moves them to the bone's pose each update.
