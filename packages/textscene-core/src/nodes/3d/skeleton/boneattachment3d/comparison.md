---
type: BoneAttachment3D
category: 3D
status: linter-only
fixture: unit-bone-attachment-3d.tscn
# image: unit-bone-attachment-3d
visual: false
renders_as: a transform-only group
---

# BoneAttachment3D

BoneAttachment3D copies one bone's global pose onto itself so its children ride that
bone, or, with `override_pose` on, pushes its own transform back onto the bone. It draws
nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008):
its children still show, at the transform the scene file states.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `bone_name` | `"Head"` | names the bone both attachments follow, bone 1 of the skeleton |
| `bone_idx` | `1` | the index Godot reads; `bone_name` only resolves to it |
| `override_pose` | `true` | on the attachment under the Skeleton3D: its transform drives the bone instead of the other way round |
| `use_external_skeleton` | `true` | on the attachment outside the Skeleton3D: look the skeleton up by path, ignoring the parent |
| `external_skeleton` | `NodePath("../Skeleton3D")` | the skeleton that attachment binds to; serialised only while the flag above is on |

## Divergences

None visible in this fixture.

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

The lenient parser reads BoneAttachment3D through `parseNode3D`, so it keeps `transform`,
`visible` and the heading fields and nothing else: `bone_name`, `bone_idx`,
`override_pose`, `use_external_skeleton` and `external_skeleton` reach no rendering
fallback at all, because there is no bone pose to fall back to. Strict parsing is where
they are read, and a bad value there is an error rather than a substitution.

## Known limitations

The previewer places a BoneAttachment3D at its authored `transform`. Godot does not: with
`override_pose` off it replaces that transform with the bone's global pose every skeleton
update (bone_attachment_3d.cpp:305-311), and with `override_pose` on it writes the
authored transform onto the bone instead. So a child of an attachment sits where the
scene file puts it here, and where the animated bone puts it in the engine. Two
statically checkable ways to bind no skeleton at all are warned about instead: a parent
that is not a Skeleton3D while `use_external_skeleton` is off, and the flag on with no
path.
