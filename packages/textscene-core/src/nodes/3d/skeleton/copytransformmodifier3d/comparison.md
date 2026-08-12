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

CopyTransformModifier3D copies a reference bone's or node's transform onto an apply bone
each frame, masked per component and per axis by its `settings/<i>/` entries. It draws
nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008): its
children still show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `setting_count` | `2` | two settings entries, so `settings/0/` and `settings/1/` exist |
| `settings/0/copy` | `7` | copies position, rotation and scale (the default, `TRANSFORM_FLAG_ALL`) |
| `settings/0/axes` | `7` | processes all three axes (the default, `AXIS_FLAG_ALL`) |
| `settings/0/invert` | `0` | inverts nothing (the default) |
| `settings/0/relative` | `true` | extracts the reference pose relative to its rest |
| `settings/0/additive` | `false` | replaces the apply bone's pose rather than adding to it |
| `settings/1/copy` | `2` | rotation only |
| `settings/1/axes` | `5` | X and Z, so the Y roll is discarded |
| `settings/1/invert` | `2` | flips the Y element of the copied rotation |
| `settings/1/additive` | `true` | adds the result to the apply bone's existing pose |
| `settings/1/reference_node` | `NodePath("../../Target")` | a node reference rather than a bone one, which is why entry 1 carries no `relative` |

No visible mark for any of them: the modifier needs a skinned Skeleton3D pose to act on,
and the previewer runs no skeleton modification.

## Divergences

None visible in this fixture. The previewer never applies the constraint, so a scene where
the modifier would visibly move a bone renders as the unmodified rest pose.

## Linting

<!-- lint:begin CopyTransformModifier3D -->
Strict parsing format-checks these `CopyTransformModifier3D` properties, plus 2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `setting_count` | integer >= 0 | error below |
| `settings/#/*` | per-setting copy, axes and invert bit masks, plus relative and additive |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
<!-- lint:end -->

CopyTransformModifier3D has no `parser.ts` of its own: it registers `parseNode3D` directly
(index.ts), so `setting_count` and every `settings/<i>/` leaf is validated but never read
back into the scene tree. An out-of-range value is reported and then dropped rather than
substituted, exactly as for the other transform-only modifiers.

Two of the strict validators are worth naming. `copy`, `axes` and `invert` report a
**warning**, not an error, for a bit outside their three-bit flag list: the setters assign
the value straight through, so Godot keeps it and only the inspector cannot express it.
And the `settings/` prefix is shared with BoneConstraint3D, which contributes `amount`,
the two bone names and the reference keys to the same family; this slice validates only
the five leaves CopyTransformModifier3D adds and hands every other leaf back to the base
chain, so a leaf the base has not declared yet is accepted rather than reported unknown.
