---
type: ModifierBoneTarget3D
category: 3D
status: linter-only
fixture: unit-modifier-bone-target-3d.tscn
# image: unit-modifier-bone-target-3d
visual: false
renders_as: a transform-only group
---

# ModifierBoneTarget3D

Attaches itself to one bone of its parent Skeleton3D and copies that bone's global pose onto its own transform each pass, so another modifier can aim at it. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin ModifierBoneTarget3D -->
Strict parsing format-checks these `ModifierBoneTarget3D` properties, plus 2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `bone` | integer >= -1 | error below |
| `bone_name` | quoted string, or the &"…" StringName jacket |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
<!-- lint:end -->

`index.ts` registers `parseNode3D` directly, so neither `bone_name` nor `bone` is ever read. An unquoted `bone_name = Head` or an out-of-range `bone = -7` is dropped rather than substituted, and only strict reports it.
