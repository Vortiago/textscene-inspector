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

ModifierBoneTarget3D attaches itself to one bone of its parent Skeleton3D and copies that
bone's global pose onto its own transform each modification pass, so another
SkeletonModifier3D can aim at it. It draws nothing at runtime, so the previewer renders it
as a transform-only group (ADR-0008): its children still show, and that absence is the
whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `bone_name` | `"Head"` | names the bone whose pose is copied, no visible mark |
| `bone` | `0` | index of that same bone, no visible mark |

## Divergences

None visible in this fixture.

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

ModifierBoneTarget3D has no `parser.ts` of its own: `index.ts` registers `parseNode3D`
directly, so neither `bone_name` nor `bone` is ever read. There is no fallback value to
name, because there is no value: an unquoted `bone_name = Head` or an out-of-range
`bone = -7` is dropped rather than substituted, and the node still renders as the
transform-only group it always does.

Two of the class's serialisation quirks are worth stating, because both are invisible in
the property list alone. `bone` carries `PROPERTY_USAGE_NO_EDITOR`, which is
`PROPERTY_USAGE_STORAGE` under another name, so it is written to the scene even though the
inspector never shows it. And `influence`, which the linter still validates through the
SkeletonModifier3D base-walk, is stripped to a bare `PROPERTY_USAGE_READ_ONLY` by this
class, dropping its storage bit: Godot's saver never emits `influence` for a
ModifierBoneTarget3D, so a hand-written one is inert rather than invalid, and the fixture
leaves it out.
