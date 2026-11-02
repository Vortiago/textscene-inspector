---
type: BoneAttachment3D
category: 3D
status: limitation
fixture: unit-bone-attachment-3d-follow.tscn
image: unit-bone-attachment-3d-follow
renders_as: nothing (a transform-only group whose children ride their bone)
---

# BoneAttachment3D

Sits on the global pose of one bone, so its children ride that bone. The skeleton is the
Skeleton3D that is its parent, or the node `external_skeleton` names under `use_external_skeleton`
(`bone_attachment_3d.cpp:128-142`). The index `bone_idx` at 0 or more wins. A negative one takes
the first bone `bone_name` names (`:113-126`).

The previewer seats the node on the bone pose over the live scene tree, after the modifiers and
the bone poses a clip writes. The boxes of the fixture ride the swung-aside ribbon. A node that
reaches no skeleton or no bone keeps the transform the file states, and so does a node with
`override_pose` on.

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

The parser reads the five own properties. `bone_name` comes in as its plain text, `bone_idx` as an
int and the two flags as bools. The seat resolves the `external_skeleton` literal against the live
tree. Only strict still format-checks the lot, so a bad value here is an error rather than a
substitution.

## Known limitations

- **Approximated** The write of an `override_pose` transform back onto its bone: the node keeps
  its authored transform, where Godot pushes it onto the bone.
- **Not drawn** A scene override of `bone_name`, `bone_idx`, `override_pose` or `use_external_skeleton` on a `BoneAttachment3D` in an instanced GLB is ignored with a warning, where Godot reads it.